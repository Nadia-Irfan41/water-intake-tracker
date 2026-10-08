const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const router = express.Router();
const pool = require("../db");

// ---- signed login token (HMAC, no extra package) ----
const SECRET = process.env.JWT_SECRET || "change-this-secret-in-env";
const b64 = (x) => Buffer.from(x).toString("base64url");
const sign = (data) => crypto.createHmac("sha256", SECRET).update(data).digest("base64url");

function createToken(userId) {
  const payload = b64(JSON.stringify({ id: userId, exp: Date.now() + 7 * 24 * 3600 * 1000 }));
  return payload + "." + sign(payload);
}

// Every protected route uses req.userId from the token, never an id sent by the browser
function requireAuth(req, res, next) {
  try {
    const [payload, sig] = (req.headers.authorization || "").replace("Bearer ", "").split(".");
    const ok = payload && sig && sig.length === sign(payload).length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(payload)));
    if (!ok) throw new Error("bad token");
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp < Date.now()) throw new Error("expired");
    req.userId = data.id;
    next();
  } catch (e) {
    res.status(401).json({ message: "Please log in again." });
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    const existingUser = await pool.query(
      "SELECT user_id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING user_id, name, email`,
      [name, email, hashedPassword]
    );

    res.status(201).json({
      message: "Registration successful",
      user: result.rows[0]
    });

  } catch (error) {
    console.error("Register error:", error);

    res.status(500).json({
      message: "Server error: " + error.message
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const result = await pool.query(
      "SELECT user_id, name, email, password FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      message: "Login successful",
      token: createToken(user.user_id),
      user: { user_id: user.user_id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error: " + error.message });
  }
});

// ---- Daily goal (water_goals) ----
router.get("/goal", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("SELECT daily_goal_ml FROM water_goals WHERE user_id = $1 ORDER BY updated_at DESC, goal_id DESC LIMIT 1", [req.userId]);
    res.json({ daily_goal_ml: r.rows.length ? r.rows[0].daily_goal_ml : null });
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

router.put("/goal", requireAuth, async (req, res) => {
  try {
    const goal = Number(req.body.daily_goal_ml);
    if (!Number.isInteger(goal) || goal < 500 || goal > 6000) {
      return res.status(400).json({ message: "Enter a goal between 500 and 6000 ml." });
    }
    // water_goals has no UNIQUE(user_id), so update the user's row, or insert one if none exists
    let r = await pool.query(
      "UPDATE water_goals SET daily_goal_ml = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING daily_goal_ml",
      [req.userId, goal]);
    if (!r.rows.length) {
      r = await pool.query(
        "INSERT INTO water_goals (user_id, daily_goal_ml) VALUES ($1, $2) RETURNING daily_goal_ml",
        [req.userId, goal]);
    }
    res.json({ daily_goal_ml: r.rows[0].daily_goal_ml });
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

// ---- Water intake (water_intake) ----
// Entries of one day: GET /api/intake?date=YYYY-MM-DD
router.get("/intake", requireAuth, async (req, res) => {
  try {
    if (!DATE_RE.test(req.query.date || "")) return res.status(400).json({ message: "Invalid date" });
    const r = await pool.query(
      `SELECT intake_id AS id, amount_ml AS ml, to_char(intake_time, 'HH12:MI AM') AS time, to_char(intake_time, 'HH24:MI') AS t24
       FROM water_intake WHERE user_id = $1 AND intake_date = $2
       ORDER BY intake_time, intake_id`, [req.userId, req.query.date]);
    res.json({ entries: r.rows });
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

// Daily totals (for Progress/History): GET /api/intake/history[?from=&to=]
router.get("/intake/history", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `SELECT to_char(intake_date, 'YYYY-MM-DD') AS date, SUM(amount_ml)::int AS total
               FROM water_intake WHERE user_id = $1`;
    const params = [req.userId];
    if (from && to) {
      if (!DATE_RE.test(from) || !DATE_RE.test(to)) return res.status(400).json({ message: "Invalid date" });
      sql += " AND intake_date BETWEEN $2 AND $3"; params.push(from, to);
    }
    sql += " GROUP BY intake_date ORDER BY intake_date DESC";
    const r = await pool.query(sql, params);
    res.json({ days: r.rows });
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

router.post("/intake", requireAuth, async (req, res) => {
  try {
    const ml = Number(req.body.amount_ml), { date, time } = req.body;
    if (!Number.isInteger(ml) || ml <= 0 || ml > 5000) return res.status(400).json({ message: "Enter a valid amount (1 - 5000 ml)." });
    if (!DATE_RE.test(date || "") || !TIME_RE.test(time || "")) return res.status(400).json({ message: "Invalid date or time" });
    const g = await pool.query("SELECT 1 FROM water_goals WHERE user_id = $1 AND daily_goal_ml > 0", [req.userId]);
    if (!g.rows.length) return res.status(400).json({ message: "Please set your daily water goal first." });
    const r = await pool.query(
      `INSERT INTO water_intake (user_id, amount_ml, intake_date, intake_time) VALUES ($1, $2, $3, $4)
       RETURNING intake_id AS id, amount_ml AS ml, to_char(intake_time, 'HH12:MI AM') AS time`,
      [req.userId, ml, date, time]);
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

router.put("/intake/:id", requireAuth, async (req, res) => {
  try {
    const ml = Number(req.body.amount_ml), { time } = req.body;
    if (!Number.isInteger(ml) || ml <= 0 || ml > 5000) return res.status(400).json({ message: "Enter a valid amount (1 - 5000 ml)." });
    if (!TIME_RE.test(time || "")) return res.status(400).json({ message: "Invalid time" });
    const r = await pool.query(
      `UPDATE water_intake SET amount_ml = $3, intake_time = $4 WHERE intake_id = $1 AND user_id = $2
       RETURNING intake_id AS id, amount_ml AS ml, to_char(intake_time, 'HH12:MI AM') AS time, to_char(intake_time, 'HH24:MI') AS t24`,
      [req.params.id, req.userId, ml, time]);
    if (!r.rowCount) return res.status(404).json({ message: "Entry not found" });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

router.delete("/intake/:id", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM water_intake WHERE intake_id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (!r.rowCount) return res.status(404).json({ message: "Entry not found" });
    res.json({ deleted: true });
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

// ---- Profile (users) ----
const GENDERS = ["Female", "Male", "Other"], LEVELS = ["Low", "Moderate", "High"];
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("SELECT name, email, age, gender, weight_kg, activity_level FROM users WHERE user_id = $1", [req.userId]);
    if (!r.rows.length) return res.status(404).json({ message: "User not found" });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

// Email is never changed here (read-only)
router.put("/profile", requireAuth, async (req, res) => {
  try {
    let name = String(req.body.name || "").trim();
    if (!name) { const cur = await pool.query("SELECT name FROM users WHERE user_id = $1", [req.userId]); name = cur.rows.length ? cur.rows[0].name : ""; }
    const age = req.body.age === null || req.body.age === "" ? null : Number(req.body.age);
    const weight = req.body.weight_kg === null || req.body.weight_kg === "" ? null : Number(req.body.weight_kg);
    const gender = req.body.gender || null, level = req.body.activity_level || null;
    if (!name || name.length > 40) return res.status(400).json({ message: "Name is required." });
    if (age === null || weight === null || !gender || !level) return res.status(400).json({ message: "Please complete all profile fields." });
    if (age !== null && (!Number.isInteger(age) || age < 5 || age > 120)) return res.status(400).json({ message: "Enter a valid age." });
    if (weight !== null && (!(weight >= 20 && weight <= 300))) return res.status(400).json({ message: "Enter a valid weight (20-300 kg)." });
    if (gender && !GENDERS.includes(gender)) return res.status(400).json({ message: "Invalid gender." });
    if (level && !LEVELS.includes(level)) return res.status(400).json({ message: "Invalid activity level." });
    const r = await pool.query(
      "UPDATE users SET name=$2, age=$3, gender=$4, weight_kg=$5, activity_level=$6 WHERE user_id=$1 RETURNING name, email, age, gender, weight_kg, activity_level",
      [req.userId, name, age, gender, weight, level]);
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

router.put("/password", requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password || String(new_password).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }
    const r = await pool.query("SELECT password FROM users WHERE user_id = $1", [req.userId]);
    if (!r.rows.length || !(await bcrypt.compare(current_password, r.rows[0].password))) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }
    await pool.query("UPDATE users SET password = $2 WHERE user_id = $1", [req.userId, await bcrypt.hash(new_password, 10)]);
    res.json({ message: "Password updated" });
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

// ---- Forgot password: 1) verify email -> short-lived reset token, 2) set new password ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pwStamp = (hash) => crypto.createHash("sha256").update(hash).digest("hex").slice(0, 16);

router.post("/forgot/verify", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim();
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
    const r = await pool.query("SELECT user_id, password FROM users WHERE lower(email) = lower($1)", [email]);
    if (!r.rows.length) return res.status(404).json({ message: "This email is not registered." });
    const payload = b64(JSON.stringify({ id: r.rows[0].user_id, purpose: "reset", s: pwStamp(r.rows[0].password), exp: Date.now() + 10 * 60 * 1000 }));
    res.json({ resetToken: payload + "." + sign(payload) });
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error. Please try again." }); }
});

router.post("/forgot/reset", async (req, res) => {
  try {
    const { resetToken, new_password, confirm_password } = req.body;
    if (!new_password || String(new_password).length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    if (new_password !== confirm_password) return res.status(400).json({ message: "Passwords do not match." });
    const [payload, sig] = String(resetToken || "").split(".");
    const ok = payload && sig && sig.length === sign(payload).length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(payload)));
    const data = ok ? JSON.parse(Buffer.from(payload, "base64url").toString()) : null;
    if (!data || data.purpose !== "reset" || data.exp < Date.now()) return res.status(400).json({ message: "Reset session expired. Please start again." });
    const u = await pool.query("SELECT password FROM users WHERE user_id = $1", [data.id]);
    if (!u.rows.length || pwStamp(u.rows[0].password) !== data.s) return res.status(400).json({ message: "Reset link already used. Please start again." });
    await pool.query("UPDATE users SET password = $2 WHERE user_id = $1", [data.id, await bcrypt.hash(new_password, 10)]);
    res.json({ message: "Password reset successful" });
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error. Please try again." }); }
});

// ---- Water reminders (per user) ----
// reminder_settings table already exists in Neon (created in the SQL Editor)

const REM_DEFAULT = { enabled: false, interval_minutes: 60, start_time: "08:00", end_time: "22:00" };
const REM_INTERVALS = [30, 45, 60, 90, 120, 180];

router.get("/reminders", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT enabled, interval_minutes, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
       FROM reminder_settings WHERE user_id = $1`, [req.userId]);
    res.json(r.rows[0] || REM_DEFAULT);
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

router.put("/reminders", requireAuth, async (req, res) => {
  try {
    const { enabled, interval_minutes, start_time, end_time } = req.body;
    const mins = Number(interval_minutes);
    if (typeof enabled !== "boolean") return res.status(400).json({ message: "Invalid reminder setting." });
    if (!REM_INTERVALS.includes(mins)) return res.status(400).json({ message: "Choose a valid reminder interval." });
    if (!TIME_RE.test(start_time || "") || !TIME_RE.test(end_time || "")) return res.status(400).json({ message: "Choose valid start and end times." });
    if (start_time === end_time) return res.status(400).json({ message: "Start and end time must be different." });
    const r = await pool.query(
      `INSERT INTO reminder_settings (user_id, enabled, interval_minutes, start_time, end_time, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET enabled = $2, interval_minutes = $3, start_time = $4, end_time = $5, updated_at = CURRENT_TIMESTAMP
       RETURNING enabled, interval_minutes, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time`,
      [req.userId, enabled, mins, start_time, end_time]);
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ message: "Server error: " + e.message }); }
});

module.exports = router;

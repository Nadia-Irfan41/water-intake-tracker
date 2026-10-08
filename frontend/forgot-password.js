const API = "/api";
const $ = (id) => document.getElementById(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let resetToken = "", userEmail = "";
const msg = (t) => { $("msg").textContent = t || ""; };
const fieldErr = (id, input, t) => { $(id).textContent = t || ""; if (input) $(input).classList.toggle("invalid", !!t); };

async function post(path, body) {
  const r = await fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || "Something went wrong.");
  return d;
}

// show / hide password
document.querySelectorAll(".eye").forEach((b) => b.addEventListener("click", () => {
  const inp = $(b.dataset.target), show = inp.type === "password";
  inp.type = show ? "text" : "password";
  b.classList.toggle("is-visible", show); b.setAttribute("aria-pressed", String(show));
  b.setAttribute("aria-label", show ? "Hide password" : "Show password");
}));

// Step 1: verify email exists
$("emailForm").addEventListener("submit", async (e) => {
  e.preventDefault(); msg(""); fieldErr("emailError", "email", "");
  const email = $("email").value.trim();
  if (!email) return fieldErr("emailError", "email", "Email is required.");
  if (!EMAIL_RE.test(email)) return fieldErr("emailError", "email", "Enter a valid email address.");
  $("emailBtn").disabled = true;
  try {
    const d = await post("/forgot/verify", { email });
    resetToken = d.resetToken; userEmail = email;
    $("forEmail").textContent = "Create a new password for " + email;
    $("emailForm").hidden = true; $("resetForm").hidden = false; $("title").textContent = "Reset Password";
    $("newPassword").focus();
  } catch (err) {
    if (/not registered/i.test(err.message)) fieldErr("emailError", "email", err.message);
    else msg(err.message === "Failed to fetch" ? "Unable to connect to the server." : err.message);
  } finally { $("emailBtn").disabled = false; }
});

// Step 2: set new password
$("resetForm").addEventListener("submit", async (e) => {
  e.preventDefault(); msg(""); fieldErr("newError", "newPassword", ""); fieldErr("confirmError", "confirmPassword", "");
  const p = $("newPassword").value, c = $("confirmPassword").value;
  if (!p) return fieldErr("newError", "newPassword", "New password is required.");
  if (p.length < 6) return fieldErr("newError", "newPassword", "Password must be at least 6 characters.");
  if (p !== c) return fieldErr("confirmError", "confirmPassword", "Passwords do not match.");
  $("resetBtn").disabled = true;
  try {
    await post("/forgot/reset", { resetToken, new_password: p, confirm_password: c });
    resetToken = ""; $("resetForm").hidden = true; $("doneBox").hidden = false; $("title").textContent = "All Set";
  } catch (err) {
    msg(err.message === "Failed to fetch" ? "Unable to connect to the server." : err.message);
    if (/expired|already used/i.test(err.message)) { $("resetForm").hidden = true; $("emailForm").hidden = false; $("title").textContent = "Forgot Password"; }
  } finally { $("resetBtn").disabled = false; }
});

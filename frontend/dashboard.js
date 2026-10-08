let entries = [];
const $ = id => document.getElementById(id);
const CIRC = 2 * Math.PI * 86;

// Header: greeting, user, date
const h = new Date().getHours();
const greet = h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
let name = "";
try {
  const u = JSON.parse(localStorage.getItem("user") || "null");
  if (!u || !u.name || !localStorage.getItem("token")) { window.location.href = "login.html"; }
  else { name = u.name; }
} catch (e) { window.location.href = "login.html"; }
$("greeting").textContent = greet + ", " + name.split(" ")[0] + "!"; $("greeting").insertAdjacentHTML("beforeend", " " + ic("hand"));
$("userName").textContent = name;
$("avatar").textContent = name.charAt(0).toUpperCase();
$("todayDate").textContent = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ---- backend helper: every request carries the logged-in user's token ----
const API_URL = "/api";
async function api(path, opts = {}) {
  const r = await fetch(API_URL + path, Object.assign({}, opts, {
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("token") || "") }
  }));
  if (r.status === 401) { localStorage.clear(); window.location.href = "login.html"; throw new Error("Please log in again."); }
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || "Request failed");
  return d;
}
const pad2 = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
const hm = d => pad2(d.getHours()) + ":" + pad2(d.getMinutes());
const lo = document.getElementById("logoutLink");
if (lo) lo.addEventListener("click", () => localStorage.clear());

// Goal and today's entries come from PostgreSQL
let GOAL = null;
let goalLoaded = false;
function setLocked(locked) {
  document.querySelectorAll("[data-add], #customBtn, #customAdd, #customInput").forEach(el => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.5" : "";
    el.style.cursor = locked ? "not-allowed" : "";
  });
}
async function loadData() {
  try {
    GOAL = (await api("/goal")).daily_goal_ml;
    goalLoaded = true;
    if (GOAL) entries = (await api("/intake?date=" + ymd(new Date()))).entries;
  } catch (e) {}
  render();
}

function render() {
  const total = entries.reduce((s, e) => s + e.ml, 0);
  const hasGoal = GOAL > 0;
  const remaining = hasGoal ? Math.max(GOAL - total, 0) : 0;
  const pct = hasGoal ? Math.min(Math.round(total / GOAL * 100), 100) : 0;
  const goalLbl = hasGoal ? GOAL + " ml" : "Not set";

  $("goalTxt").textContent = goalLbl;
  $("intakeTxt").textContent = total + " ml";
  $("remainTxt").textContent = remaining + " ml";
  $("pctTxt").textContent = pct + "%";
  $("ringPct").textContent = pct + "%";
  $("ringAmt").textContent = hasGoal ? total + " / " + GOAL + " ml" : total + " ml";
  $("amountLine").textContent = hasGoal ? total + " / " + GOAL + " ml" : total + " ml";
  $("totalTxt").textContent = total + " ml";
  $("bar").style.strokeDashoffset = CIRC * (1 - pct / 100);

  const st = $("status");
  const done = hasGoal && total >= GOAL;
  st.classList.toggle("done", done);
  st.innerHTML = !hasGoal ? "Set your daily goal in Profile to start tracking " + ic("droplet") : done ? ic("award") + "Daily Goal Completed!" : remaining + " ml more to reach your daily goal " + ic("droplet");

  if (!hasGoal && goalLoaded) st.innerHTML = 'Please set your daily water goal first. <a href="profile.html">Set goal</a>';
  setLocked(!hasGoal);

  const ul = $("entries");
  ul.innerHTML = "";
  if (!entries.length) { ul.innerHTML = '<li class="empty">No entries yet. Add some water ' + ic("droplet") + '</li>'; return; }
  entries.forEach(e => {
    const li = document.createElement("li");
    li.innerHTML = '<span>' + ic("droplet") + '</span><span class="t">' + e.time + '</span><b>' + e.ml + ' ml</b>';
    const b = document.createElement("button");
    b.className = "del"; b.innerHTML = ic("trash"); b.setAttribute("aria-label", "Delete entry");
    b.onclick = async () => {
      try { await api("/intake/" + e.id, { method: "DELETE" }); entries = entries.filter(x => x.id !== e.id); render(); }
      catch (err) { alert(err.message); }
    };
    li.appendChild(b);
    ul.appendChild(li);
  });
}

async function addWater(ml) {
  if (!GOAL) { alert("Please set your daily water goal first."); return; }
  const now = new Date();
  try {
    const saved = await api("/intake", { method: "POST", body: JSON.stringify({ amount_ml: ml, date: ymd(now), time: hm(now) }) });
    entries.push(saved); render();
  } catch (err) { alert(err.message); }
}

document.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => addWater(parseInt(b.dataset.add, 10))));

$("customBtn").addEventListener("click", () => { $("customBox").hidden = !$("customBox").hidden; $("customInput").focus(); });
function addCustom() {
  const v = Number($("customInput").value);
  if (!Number.isInteger(v) || v <= 0 || v > 5000) { $("customErr").textContent = "Enter a valid amount (1 - 5000 ml)."; return; }
  $("customErr").textContent = ""; addWater(v); $("customInput").value = "";
}
$("customAdd").addEventListener("click", addCustom);
$("customInput").addEventListener("keydown", e => { if (e.key === "Enter") addCustom(); });

// Mobile menu
const toggle = open => { $("sidebar").classList.toggle("open", open); $("overlay").classList.toggle("show", open); };
$("burger").addEventListener("click", () => toggle(true));
$("overlay").addEventListener("click", () => toggle(false));

render();
loadData();

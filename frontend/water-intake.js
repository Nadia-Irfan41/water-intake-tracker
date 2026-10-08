let entries = [];
const $ = id => document.getElementById(id);

let name = "";
try {
  const u = JSON.parse(localStorage.getItem("user") || "null");
  if (!u || !u.name || !localStorage.getItem("token")) { window.location.href = "login.html"; }
  else { name = u.name; }
} catch (e) { window.location.href = "login.html"; }
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
const lo = $("logoutLink"); if (lo) lo.addEventListener("click", () => localStorage.clear());
const say = (t, ok) => { $("addMsg").textContent = t || ""; $("addMsg").classList.toggle("ok", !!ok); };

async function load() {
  try { entries = (await api("/intake?date=" + ymd(new Date()))).entries; }
  catch (e) { say(e.message || "Unable to load entries."); }
  render();
}

function render() {
  const ul = $("entries"); ul.innerHTML = "";
  $("empty").hidden = entries.length > 0;
  $("tableWrap").hidden = entries.length === 0;
  entries.forEach(e => {
    const li = document.createElement("li");
    const t = document.createElement("span"); t.textContent = e.time;
    const a = document.createElement("b"); a.textContent = e.ml + " ml";
    const box = document.createElement("div"); box.className = "w2-ab";
    const ed = document.createElement("button"); ed.innerHTML = ic("pencil") + "Edit"; ed.onclick = () => openEdit(e);
    const dl = document.createElement("button"); dl.className = "d"; dl.innerHTML = ic("trash") + "Delete"; dl.onclick = () => openDel(e);
    box.append(ed, dl); li.append(t, a, box); ul.appendChild(li);
  });
}

async function addWater(ml) {
  ml = Number(ml);
  if (!Number.isInteger(ml) || ml < 1 || ml > 5000) return say("Enter a valid amount (1 – 5000 ml).");
  const now = new Date();
  try {
    await api("/intake", { method: "POST", body: JSON.stringify({ amount_ml: ml, date: ymd(now), time: hm(now) }) });
    say("Added " + ml + " ml.", true); $("customInput").value = "";
    await load();
  } catch (err) { say(err.message || "Unable to connect to the server."); }
}
document.querySelectorAll("[data-add]").forEach(b => b.onclick = () => addWater(b.dataset.add));
$("customForm").onsubmit = e => { e.preventDefault(); addWater($("customInput").value); };

// ---- edit ----
let cur = null;
function openEdit(e) { cur = e; $("editMl").value = e.ml; $("editTime").value = e.t24 || ""; $("editErr").textContent = ""; $("editModal").hidden = false; $("editMl").focus(); }
$("editCancel").onclick = () => $("editModal").hidden = true;
$("editForm").onsubmit = async ev => {
  ev.preventDefault();
  const ml = Number($("editMl").value), time = $("editTime").value;
  if (!Number.isInteger(ml) || ml < 1 || ml > 5000) return $("editErr").textContent = "Enter a valid amount (1 – 5000 ml).";
  if (!time) return $("editErr").textContent = "Choose a time.";
  try {
    await api("/intake/" + cur.id, { method: "PUT", body: JSON.stringify({ amount_ml: ml, time }) });
    $("editModal").hidden = true; say("Entry updated.", true); await load();
  } catch (err) { $("editErr").textContent = err.message || "Unable to connect to the server."; }
};

// ---- delete ----
function openDel(e) { cur = e; $("delText").textContent = "Delete the " + e.ml + " ml entry at " + e.time + "?"; $("delModal").hidden = false; }
$("delCancel").onclick = () => $("delModal").hidden = true;
$("delOk").onclick = async () => {
  try { await api("/intake/" + cur.id, { method: "DELETE" }); $("delModal").hidden = true; say("Entry deleted.", true); await load(); }
  catch (err) { $("delModal").hidden = true; say(err.message || "Unable to delete."); }
};
document.querySelectorAll(".w2-modal").forEach(m => m.onclick = e => { if (e.target === m) m.hidden = true; });

const toggle = o => { $("sidebar").classList.toggle("open", o); $("overlay").classList.toggle("show", o); };
$("burger").onclick = () => toggle(true); $("overlay").onclick = () => toggle(false);
load();

// Goal and records come from PostgreSQL
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
if (!localStorage.getItem('token')) window.location.href = 'login.html';
const lo2 = document.getElementById('logoutLink'); if (lo2) lo2.addEventListener('click', () => localStorage.clear());
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
let GOAL = null;
let records = [];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = d => `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const same = (a, b) => a.toDateString() === b.toDateString();

function inRange(d, f) {
  if (f === 'today') return same(d, TODAY);
  if (f === 'week') {
    const start = new Date(TODAY); start.setDate(TODAY.getDate() - ((TODAY.getDay() + 6) % 7)); // Monday
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return d >= start && d <= end;
  }
  return d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear();
}

function render(f) {
  const list = records.filter(r => inRange(r.date, f));
  document.getElementById('rows').innerHTML = list.length ? list.map(r => {
    const pct = Math.min(100, Math.round(r.consumed / (GOAL || 1) * 100));
    const done = GOAL && r.consumed >= GOAL;
    return `<tr><td>${fmt(r.date)}</td><td>${GOAL ? GOAL + ' ml' : 'Not set'}</td><td>${r.consumed} ml</td><td>${pct}%</td>
      <td><span class="pill ${done ? 'done' : 'inc'}">${ic(done ? 'check-circle' : 'clock')}${done ? 'Completed' : 'Incomplete'}</span></td></tr>`;
  }).join('') : '<tr><td colspan="5" class="none">No records found.</td></tr>';
  document.querySelectorAll('.fbtn').forEach(b => b.classList.toggle('active', b.dataset.f === f));
}

document.querySelectorAll('.fbtn').forEach(b => b.onclick = () => render(b.dataset.f));
const toggle = o => { sidebar.classList.toggle('open', o); overlay.classList.toggle('show', o); };
burger.onclick = () => toggle(true); overlay.onclick = () => toggle(false);
render('today');
(async () => {
  try {
    GOAL = (await api('/goal')).daily_goal_ml;
    const h = await api('/intake/history');
    records = h.days.map(r => { const [y, m, d] = r.date.split('-').map(Number); return { date: new Date(y, m - 1, d), consumed: r.total }; });
  } catch (e) {}
  render('today');
})();

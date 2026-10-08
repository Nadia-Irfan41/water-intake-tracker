// Goal and intake history come from PostgreSQL (zeros until loaded)
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
let GOAL = null;
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
let monthData = [0,1,2,3].map(() => [0,0,0,0,0,0,0]);
let weekData = monthData[3];
const $ = id => document.getElementById(id);
const sum = a => a.reduce((x,y)=>x+y,0);
const L = ml => (ml/1000).toFixed(1) + ' L';
let period = 'week';

function stats(arr) {
  const done = GOAL ? arr.filter(v => v >= GOAL).length : 0;
  const avg = Math.round(sum(arr)/arr.length);
  return { total:sum(arr), avg, done, miss:arr.length-done, n:arr.length, best:Math.max(...arr),
           pct:GOAL ? Math.round(avg/GOAL*100) : 0 };
}

function axisMax() {
  const top = Math.max(GOAL || 0, ...monthData.flat(), 500);
  return Math.ceil(top / 500) * 500;
}
function axisTicks(max) {
  const step = max <= 3000 ? 500 : Math.ceil(max / 6 / 500) * 500, t = [];
  for (let v = 0; v <= max; v += step) t.push(v);
  return t;
}

async function loadGoal() {
  try {
    GOAL = (await api('/goal')).daily_goal_ml;
    // 4 weeks (Mon-Sun), the last one being the current week
    const mon = new Date(); mon.setHours(0,0,0,0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const start = new Date(mon); start.setDate(mon.getDate() - 21);
    const end = new Date(mon); end.setDate(mon.getDate() + 6);
    const h = await api('/intake/history?from=' + ymd(start) + '&to=' + ymd(end));
    const byDay = {}; h.days.forEach(r => byDay[r.date] = r.total);
    monthData = [0,1,2,3].map(w => [0,1,2,3,4,5,6].map(d => {
      const day = new Date(start); day.setDate(start.getDate() + w*7 + d);
      return byDay[ymd(day)] || 0;
    }));
    weekData = monthData[3];
  } catch (e) {}
  document.querySelectorAll('.goalTxt').forEach(el => el.textContent = GOAL ? GOAL + ' ml' : 'Not set');
}

function drawBars() {
  const max = axisMax(), el = $('bars'), ticks = axisTicks(max);
  let h = '';
  ticks.forEach(v => h += `<span class="y" style="bottom:calc(${v/max*100}% * (100% - 26px) / 100% + 26px)"></span>`);
  h = '';
  weekData.forEach((v,i) => h += `<div class="col"><div class="bar-i ${GOAL&&v>=GOAL?'hit':''}" style="height:${v/max*100}%" data-v="${v} ml"></div><span class="lbl">${DAYS[i]}</span></div>`);
  el.innerHTML = h;
  // y labels + goal line (plot area = height minus 26px bottom padding)
  const H = el.clientHeight - 26;
  ticks.forEach(v => {
    const s = document.createElement('span'); s.className='y'; s.textContent=v;
    s.style.bottom = (26 + v/max*H) + 'px'; el.appendChild(s);
  });
  if (GOAL) { const g = document.createElement('div'); g.className='goal-line';
  g.style.bottom = (26 + GOAL/max*H) + 'px'; g.innerHTML = '<span>Goal</span>'; el.appendChild(g); }
}

function drawLine() {
  const pts = monthData.map(w => Math.round(sum(w)/7));
  const W=Math.max(500,$('line').clientWidth), H=380, l=48, r=16, t=16, b=30, max=axisMax();
  const x = i => l + i*(W-l-r)/(pts.length-1), y = v => t + (1-v/max)*(H-t-b);
  let s = `<svg viewBox="0 0 ${W} ${H}" >`;
  axisTicks(max).forEach(v => s += `<line x1="${l}" x2="${W-r}" y1="${y(v)}" y2="${y(v)}" stroke="#e8f1fd"/><text x="${l-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`);
  if (GOAL) s += `<line x1="${l}" x2="${W-r}" y1="${y(GOAL)}" y2="${y(GOAL)}" stroke="#f59e0b" stroke-dasharray="5 4" stroke-width="2"/>`;
  const path = pts.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' ');
  s += `<defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8" stop-opacity=".45"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/></linearGradient></defs>`;
  s += `<path d="${path} L${x(pts.length-1)},${y(0)} L${x(0)},${y(0)} Z" fill="url(#ar)"/><path d="${path}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linejoin="round"/>`;
  pts.forEach((v,i) => s += `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="#fff" stroke="#2563eb" stroke-width="2.5"><title>Week ${i+1}: ${v} ml</title></circle><text x="${x(i)}" y="${H-8}" text-anchor="middle">Week ${i+1}</text>`);
  $('line').innerHTML = s + '</svg>';
}

function insight(s, label) {
  const ratio = s.done / s.n;
  if (!GOAL) return 'Set your daily goal in Profile to see your progress.';
  let msg = `You reached your daily goal on ${s.done} out of ${s.n} days ${label}. `;
  if (ratio >= .85) msg += 'Excellent consistency, keep it up!';
  else if (ratio >= .6) msg += 'Keep going to build a consistent hydration habit!';
  else if (ratio >= .3) msg += `Try a reminder or a bottle by your desk. You are averaging ${s.avg} ml of ${GOAL} ml.`;
  else msg += 'Start small: add one extra glass of water each day.';
  return msg;
}

function render() {
  const arr = period === 'week' ? weekData : monthData.flat();
  const s = stats(arr), label = period === 'week' ? 'this week' : 'this month';
  $('sAvg').textContent = L(s.avg);
  $('sPct').textContent = s.pct + '%';
  $('sDays').textContent = `${s.done} / ${s.n} days`;
  $('sBest').textContent = L(s.best);
  $('insight').textContent = insight(s, label);
  $('weekCard').hidden = period !== 'week';
  $('monthCard').hidden = period !== 'month';
  if (period === 'week') drawBars(); else drawLine();
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('active', b.dataset.p === period));
}

document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { period = b.dataset.p; render(); });
const toggle = o => { $('sidebar').classList.toggle('open', o); $('overlay').classList.toggle('show', o); };
$('burger').onclick = () => toggle(true); $('overlay').onclick = () => toggle(false);
window.addEventListener('resize', () => period === 'week' ? drawBars() : drawLine());
render();
loadGoal().then(render);

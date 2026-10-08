const API_URL = '/api';
const $ = id => document.getElementById(id);
if (!localStorage.getItem('token')) location.replace('login.html');
$('yr').textContent = new Date().getFullYear();
async function api(path, opts = {}) {
  const r = await fetch(API_URL + path, Object.assign({}, opts, {
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
  }));
  if (r.status === 401) { localStorage.clear(); location.replace('login.html'); throw new Error('Please log in again.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
}
let pname = '';
try { pname = (JSON.parse(localStorage.getItem('user') || '{}') || {}).name || ''; } catch (e) {}
Promise.all([api('/profile'), api('/goal')]).then(([p, g]) => {
  pname = p.name || pname;
  if (p.age && p.gender && p.weight_kg && p.activity_level && g.daily_goal_ml) { location.replace('dashboard.html'); return; }
  if (p.age) $('age').value = p.age; if (p.gender) $('gender').value = p.gender;
  if (p.weight_kg) $('weight').value = p.weight_kg; if (p.activity_level) $('activity').value = p.activity_level;
  if (g.daily_goal_ml) $('goal').value = g.daily_goal_ml;
}).catch(() => {});
$('logoutBtn').onclick = () => { localStorage.clear(); location.href = 'index.html'; };
$('setupForm').onsubmit = async e => {
  e.preventDefault();
  const age = Number($('age').value), weight = Number($('weight').value), goal = parseInt($('goal').value, 10);
  const gender = $('gender').value, activity = $('activity').value, err = $('err');
  if (!age || !gender || !weight || !activity || !goal) return err.textContent = 'Please complete all fields.';
  if (age < 5 || age > 120) return err.textContent = 'Enter a valid age.';
  if (weight < 20 || weight > 300) return err.textContent = 'Enter a valid weight (20–300 kg).';
  if (goal < 500 || goal > 6000) return err.textContent = 'Enter a goal between 500 and 6000 ml.';
  try {
    await api('/profile', { method: 'PUT', body: JSON.stringify({ name: pname, age, gender, weight_kg: weight, activity_level: activity }) });
    await api('/goal', { method: 'PUT', body: JSON.stringify({ daily_goal_ml: goal }) });
    location.href = 'dashboard.html';
  } catch (ex) { err.textContent = ex.message || 'Unable to connect to the server.'; }
};

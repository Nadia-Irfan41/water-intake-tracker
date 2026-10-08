// Logged-in user saved by login.js
let saved = null;
try { saved = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) {}
if (!saved || !saved.name || !localStorage.getItem('token')) { location.href = 'login.html'; }

const API_URL = '/api';
async function api(path, opts = {}) {
  const r = await fetch(API_URL + path, Object.assign({}, opts, {
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
  }));
  if (r.status === 401 && path !== '/password') { localStorage.clear(); location.href = 'login.html'; throw new Error('Please log in again.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
}
const $ = id => document.getElementById(id);
const profile = { name: saved.name, email: saved.email, age: null, gender: '', weight: null, activity: '', goal: null };

const show = v => (v === null || v === undefined || v === '') ? '—' : v;
function render() {
  $('hName').textContent = profile.name;
  const map = { name: profile.name, email: profile.email, age: show(profile.age),
    gender: show(profile.gender), weight: profile.weight ? profile.weight + ' kg' : '—', activity: show(profile.activity) };
  document.querySelectorAll('[data-v]').forEach(el => el.textContent = map[el.dataset.v]);
  $('goalVal').textContent = profile.goal ? profile.goal + ' ml' : 'Not set';
}

// Load saved data from the database
api('/profile').then(d => {
  Object.assign(profile, { name: d.name, email: d.email, age: d.age, gender: d.gender || '', weight: d.weight_kg, activity: d.activity_level || '' });
  try { localStorage.setItem('user', JSON.stringify(Object.assign({}, saved, { name: d.name, email: d.email }))); } catch (e) {}
  render();
}).catch(() => render());
api('/goal').then(d => { profile.goal = d.daily_goal_ml; render(); }).catch(() => {});

// Generic view/edit toggle for a card
function setEditing(form, on) {
  form.querySelectorAll('.val').forEach(v => v.hidden = on);
  form.querySelectorAll('input,select').forEach(i => i.hidden = !on);
  form.querySelector('[id$="Edit"]').hidden = on;
  form.querySelector('[id$="Save"]').hidden = !on;
  form.querySelector('[id$="Cancel"]').hidden = !on;
}
const say = (id, text, ok) => { $(id).textContent = text || ''; $(id).classList.toggle('ok', !!ok); };

// ---- Personal info ----
const infoForm = $('infoForm');
$('infoEdit').onclick = () => {
  $('fName').value = profile.name; $('fEmail').value = profile.email;
  $('fAge').value = profile.age || ''; $('fGender').value = profile.gender;
  $('fWeight').value = profile.weight || ''; $('fActivity').value = profile.activity;
  say('infoMsg', ''); setEditing(infoForm, true); $('fName').focus();
};
$('infoCancel').onclick = () => { say('infoMsg', ''); setEditing(infoForm, false); };
infoForm.onsubmit = async e => {
  e.preventDefault();
  const name = $('fName').value.trim(), age = $('fAge').value, weight = $('fWeight').value;
  if (!name) return say('infoMsg', 'Name is required.');
  if (!age || !$('fGender').value || !weight || !$('fActivity').value) return say('infoMsg', 'Please complete all fields.');
  if (age < 5 || age > 120) return say('infoMsg', 'Enter a valid age.');
  if (weight < 20 || weight > 300) return say('infoMsg', 'Enter a valid weight (20–300 kg).');
  try {
    const d = await api('/profile', { method: 'PUT', body: JSON.stringify({
      name, age: age || null, gender: $('fGender').value || null, weight_kg: weight || null, activity_level: $('fActivity').value || null }) });
    Object.assign(profile, { name: d.name, age: d.age, gender: d.gender || '', weight: d.weight_kg, activity: d.activity_level || '' });
    try { localStorage.setItem('user', JSON.stringify(Object.assign({}, saved, { name: d.name }))); } catch (e) {}
    render(); setEditing(infoForm, false); say('infoMsg', 'Changes saved.', true);
  } catch (err) { say('infoMsg', err.message || 'Unable to connect to the server.'); }
};

// ---- Water goal ----
const goalForm = $('goalForm');
$('goalEdit').onclick = () => { $('fGoal').value = profile.goal || ''; say('goalMsg', ''); setEditing(goalForm, true); $('fGoal').focus(); };
$('goalCancel').onclick = () => { say('goalMsg', ''); setEditing(goalForm, false); };
goalForm.onsubmit = async e => {
  e.preventDefault();
  const g = parseInt($('fGoal').value, 10);
  if (!g || g < 500 || g > 6000) return say('goalMsg', 'Enter a goal between 500 and 6000 ml.');
  try {
    const d = await api('/goal', { method: 'PUT', body: JSON.stringify({ daily_goal_ml: g }) });
    profile.goal = d.daily_goal_ml; render(); setEditing(goalForm, false); say('goalMsg', 'Goal updated.', true);
  } catch (err) { say('goalMsg', err.message || 'Unable to connect to the server.'); }
};

// ---- Account settings ----
const open = m => { m.hidden = false; const i = m.querySelector('input'); if (i) i.focus(); };
const close = m => { m.hidden = true; };
$('pwBtn').onclick = () => { $('pwForm').reset(); $('pwErr').textContent = ''; open($('pwModal')); };
$('pwForm').onsubmit = async e => {
  e.preventDefault();
  const o = $('pwOld').value, n = $('pwNew').value, n2 = $('pwNew2').value;
  if (!o || !n) return $('pwErr').textContent = 'Fill in all fields.';
  if (n.length < 6) return $('pwErr').textContent = 'New password must be at least 6 characters.';
  if (n !== n2) return $('pwErr').textContent = 'New passwords do not match.';
  try {
    await api('/password', { method: 'PUT', body: JSON.stringify({ current_password: o, new_password: n }) });
    close($('pwModal')); say('infoMsg', ''); alert('Password updated.');
  } catch (err) { $('pwErr').textContent = err.message || 'Unable to connect to the server.'; }
};
$('logoutBtn').onclick = () => open($('logoutModal'));
$('confirmOut').onclick = () => { try { localStorage.clear(); } catch (e) {} location.href = 'index.html'; };

document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => close(b.closest('.modal')));
document.querySelectorAll('.modal').forEach(m => m.onclick = e => { if (e.target === m) close(m); });
document.querySelectorAll('.logoutLink').forEach(a => a.onclick = e => { e.preventDefault(); open($('logoutModal')); });
const toggle = o => { $('sidebar').classList.toggle('open', o); $('overlay').classList.toggle('show', o); };
$('burger').onclick = () => toggle(true); $('overlay').onclick = () => toggle(false);
render();

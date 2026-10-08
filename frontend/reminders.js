// Water reminders: settings saved per user in the database, reminders fired in-app + via browser notifications.
(function () {
  var API = '/api';
  var INTERVALS = [[30, '30 minutes'], [45, '45 minutes'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours'], [180, '3 hours']];
  var MESSAGES = ['Time to drink some water. Your body will thank you.', 'Hydration check: grab a glass of water now.', 'A quick sip keeps you energised. Drink some water.', 'Reminder: have a glass of water and log it in your tracker.'];

  // ---- pure helpers (also used by tests) ----
  function toMin(t) { var p = String(t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1]); }
  function inWindow(s, d) {
    var m = d.getHours() * 60 + d.getMinutes(), a = toMin(s.start_time), b = toMin(s.end_time);
    return a <= b ? (m >= a && m <= b) : (m >= a || m <= b);
  }
  function shouldFire(s, now, last) { return !!(s && s.enabled && inWindow(s, now) && now.getTime() >= last + s.interval_minutes * 60000); }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { toMin: toMin, inWindow: inWindow, shouldFire: shouldFire }; }
  if (typeof document === 'undefined') return;

  var token = localStorage.getItem('token'); if (!token) return;
  var u = {}; try { u = JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch (e) {}
  var uid = String(u.id || u.email || u.name || 'user');
  var LAST = 'wit_rem_last_' + uid, ASKED = 'wit_notif_asked', UNREAD = 'wit_rem_unread_' + uid;
  var settings = null, saveTimer = null, panel, bell;

  function api(path, opts) {
    return fetch(API + path, Object.assign({}, opts || {}, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } }))
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.message || 'Request failed'); return d; }); });
  }
  var getLast = function () { return Number(localStorage.getItem(LAST)) || 0; };
  var setLast = function (t) { localStorage.setItem(LAST, String(t)); };
  var perm = function () { return ('Notification' in window) ? Notification.permission : 'unsupported'; };

  // ---- reminder delivery ----
  function toast(text) {
    var t = document.createElement('div'); t.className = 'rem-toast'; t.setAttribute('role', 'alert');
    t.innerHTML = '<span class="rem-ti">' + ic('droplet') + '</span><div><b>Water Reminder</b><p></p></div><button aria-label="Dismiss">' + ic('x') + '</button>';
    t.querySelector('p').textContent = text;
    t.querySelector('button').onclick = function () { t.remove(); };
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 12000);
  }
  function fire(isTest) {
    var text = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    toast(text);
    if (perm() === 'granted') { try { new Notification('Water Reminder', { body: text, tag: 'wit-water-reminder' }); } catch (e) {} }
    if (!isTest) { localStorage.setItem(UNREAD, '1'); markBell(); }
  }
  function tick() {
    if (!settings) return;
    var now = new Date(), last = getLast();
    if (shouldFire(settings, now, last)) {
      if (getLast() !== last) return;          // another tab already fired
      setLast(now.getTime()); fire(false);
    }
  }

  // ---- UI ----
  function markBell() { if (bell) bell.classList.toggle('has-unread', localStorage.getItem(UNREAD) === '1'); }
  function permHtml() {
    var p = perm();
    if (p === 'granted') return '<div class="rem-perm ok">' + ic('check-circle') + 'Browser notifications are on.</div>';
    if (p === 'denied') return '<div class="rem-perm warn">' + ic('bell-off') + '<span>Browser notifications are blocked. Allow them in your browser\'s site settings to get reminders outside this tab. In-app reminders will still appear.</span></div>';
    if (p === 'unsupported') return '<div class="rem-perm warn">' + ic('bell-off') + '<span>This browser does not support notifications. In-app reminders will still appear.</span></div>';
    return '<div class="rem-perm"><span>Allow browser notifications to be reminded even when this tab is in the background.</span><button type="button" class="rem-ghost" id="remAllow">Allow notifications</button></div>';
  }
  function build() {
    var right = document.querySelector('.main .topbar .top-right'); bell = right && right.querySelector('.bell'); if (!bell) return;
    right.style.position = 'relative';
    panel = document.createElement('div'); panel.className = 'rem-panel'; panel.hidden = true;
    panel.innerHTML =
      '<div class="rem-head"><h4>' + ic('bell') + 'Water Reminders</h4>' +
      '<label class="rem-switch"><input type="checkbox" id="remOn"><span></span></label></div>' +
      '<div class="rem-body" id="remBody">' +
      '<label class="rem-l">Remind me every<select id="remInt">' + INTERVALS.map(function (i) { return '<option value="' + i[0] + '">' + i[1] + '</option>'; }).join('') + '</select></label>' +
      '<div class="rem-row"><label class="rem-l">From<input type="time" id="remFrom"></label><label class="rem-l">Until<input type="time" id="remTo"></label></div>' +
      '</div><div id="remPerm"></div>' +
      '<div class="rem-foot"><span id="remStatus" role="status"></span><button type="button" class="rem-ghost" id="remTest">Send test</button></div>';
    right.appendChild(panel);
    bell.addEventListener('click', function (e) { e.stopPropagation(); panel.hidden = !panel.hidden; if (!panel.hidden) { localStorage.removeItem(UNREAD); markBell(); refreshPerm(); } });
    document.addEventListener('click', function (e) { if (!panel.hidden && !panel.contains(e.target)) panel.hidden = true; });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    ['remOn', 'remInt', 'remFrom', 'remTo'].forEach(function (id) { document.getElementById(id).addEventListener('change', onChange); });
    document.getElementById('remTest').onclick = function () { fire(true); };
    markBell();
  }
  function refreshPerm() {
    var box = document.getElementById('remPerm'); if (!box) return; box.innerHTML = permHtml();
    var b = document.getElementById('remAllow'); if (b) b.onclick = askPermission;
  }
  function askPermission() {
    localStorage.setItem(ASKED, '1');
    if (perm() !== 'default') return refreshPerm();
    Notification.requestPermission().then(refreshPerm, refreshPerm);
  }
  function fillForm() {
    document.getElementById('remOn').checked = settings.enabled; document.getElementById('remInt').value = settings.interval_minutes;
    document.getElementById('remFrom').value = settings.start_time; document.getElementById('remTo').value = settings.end_time;
    document.getElementById('remBody').classList.toggle('off', !settings.enabled); refreshPerm();
  }
  function status(t, bad) { var s = document.getElementById('remStatus'); if (s) { s.textContent = t || ''; s.className = bad ? 'bad' : ''; } }
  function onChange() {
    var next = { enabled: document.getElementById('remOn').checked, interval_minutes: Number(document.getElementById('remInt').value),
      start_time: document.getElementById('remFrom').value, end_time: document.getElementById('remTo').value };
    if (!next.start_time || !next.end_time) return status('Choose both times.', true);
    if (next.start_time === next.end_time) return status('Start and end time must be different.', true);
    var turnedOn = next.enabled && !settings.enabled;
    var intervalChanged = next.interval_minutes !== settings.interval_minutes;
    status('Saving...');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      api('/reminders', { method: 'PUT', body: JSON.stringify(next) }).then(function (d) {
        settings = d; if (turnedOn || intervalChanged) setLast(Date.now());
        fillForm(); status('Saved');
        // ask for browser permission only when reminders are switched on, and only once automatically
        if (turnedOn && perm() === 'default' && !localStorage.getItem(ASKED)) askPermission();
      }).catch(function (e) { status(e.message === 'Failed to fetch' ? 'Unable to connect to the server.' : e.message, true); });
    }, 350);
  }

  function init() {
    build();
    api('/reminders').then(function (d) {
      settings = d; if (panel) fillForm();
      if (d.enabled && !getLast()) setLast(Date.now());
      tick(); setInterval(tick, 20000);
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

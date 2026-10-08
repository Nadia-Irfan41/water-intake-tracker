// Profile-setup guard: every app page stays hidden until the profile is completed.
(function () {
  var st = document.createElement('style'); st.id = 'guardHide';
  st.textContent = 'html{visibility:hidden}'; document.head.appendChild(st);
  var reveal = function () { var s = document.getElementById('guardHide'); if (s) s.remove(); };
  var token = localStorage.getItem('token');
  if (!token) { location.replace('login.html'); return; }
  var get = function (p) {
    return fetch('/api' + p, { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) { if (r.status === 401) { localStorage.clear(); location.replace('login.html'); throw 0; } return r.json(); });
  };
  Promise.all([get('/profile'), get('/goal')]).then(function (v) {
    var p = v[0], g = v[1];
    var done = !!(p.age && p.gender && p.weight_kg && p.activity_level && g.daily_goal_ml);
    if (!done) { location.replace('profile-setup.html'); return; }
    reveal();
  }).catch(function () { reveal(); });
})();

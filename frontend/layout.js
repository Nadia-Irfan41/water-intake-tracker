// Shared header (top bar) and footer for every app page.
(function () {
  var main = document.querySelector('.main'); if (!main) return;
  var u = {}; try { u = JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch (e) {}
  var name = u.name || 'User';
  var TITLES = { 'profile.html': ['My Profile', 'Manage your personal information and water goal.'],
                 'history.html': ['Water Intake History', 'Review your past water intake.'] };
  var page = location.pathname.split('/').pop();
  var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'layout.css'; document.head.appendChild(link);

  var bar = main.querySelector('.topbar');
  if (!bar) {                                   // pages that had no header (Profile, History)
    var oldBurger = main.querySelector(':scope > .burger'); if (oldBurger) oldBurger.remove();
    var t = TITLES[page] || ['Water Intake Tracker', ''];
    bar = document.createElement('header'); bar.className = 'topbar';
    bar.innerHTML = '<button class="burger" id="burger" aria-label="Open menu">' + ic('menu') + '</button>' +
      '<div class="greet"><h1></h1><p></p></div><div class="top-right"></div>';
    bar.querySelector('h1').textContent = t[0]; bar.querySelector('p').textContent = t[1];
    var body = document.createElement('div'); body.className = 'page-body';
    while (main.firstChild) body.appendChild(main.firstChild);
    main.appendChild(bar); main.appendChild(body);
  }
  var right = bar.querySelector('.top-right');
  if (!right) { right = document.createElement('div'); right.className = 'top-right'; bar.appendChild(right); }
  if (!right.querySelector('.bell')) {
    var b = document.createElement('button'); b.className = 'bell'; b.setAttribute('aria-label', 'Notifications'); b.innerHTML = ic('bell') + '<i></i>'; right.insertBefore(b, right.firstChild);
  }
  if (!right.querySelector('.user')) {
    var d = document.createElement('div'); d.className = 'user';
    d.innerHTML = '<div class="avatar" id="avatar"></div><div><strong id="userName"></strong><small id="todayDate"></small></div>';
    right.appendChild(d);
  }
  var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
  set('userName', name); set('avatar', name.charAt(0).toUpperCase());
  set('todayDate', new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));

  if (!main.querySelector('.app-footer')) {
    var f = document.createElement('footer'); f.className = 'app-footer';
    f.innerHTML = ic('droplet') + '<b>Water Intake Tracker</b> · Stay hydrated, stay healthy · © ' + new Date().getFullYear();
    main.appendChild(f);
  }
})();

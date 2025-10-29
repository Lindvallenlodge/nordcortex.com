// assets/js/header-loader.js
(function () {
  const insertHeader = (markup) => {
    // Create mount if not present
    let mount = document.getElementById('site-header');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'site-header';
      document.body.insertBefore(mount, document.body.firstChild);
    }
    mount.innerHTML = markup;

    // wire up mobile menu
    const burger = document.querySelector('.hamburger');
    const menu = document.querySelector('.mobile-menu');
    const overlay = document.querySelector('.overlay');
    const closeBtn = document.querySelector('.close-btn');

    const close = () => { menu.classList.remove('open'); overlay.classList.remove('show'); };
    const open  = () => { menu.classList.add('open'); overlay.classList.add('show'); };

    burger && burger.addEventListener('click', open);
    overlay && overlay.addEventListener('click', close);
    closeBtn && closeBtn.addEventListener('click', close);

    // accordion groups
    document.querySelectorAll('.menu-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.parentElement;
        const isOpen = group.classList.contains('open');
        document.querySelectorAll('.menu-group').forEach(g => g.classList.remove('open'));
        if (!isOpen) group.classList.add('open');
      });
    });
  };

  const tryPaths = ['partials/header.html', '/partials/header.html'];
  const load = async () => {
    for (const p of tryPaths) {
      try {
        const res = await fetch(p, { cache: 'no-store' });
        if (res.ok) { insertHeader(await res.text()); return; }
      } catch (e) {}
    }
    console.warn('Header include not found. Check /partials/header.html path.');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();

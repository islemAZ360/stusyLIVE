/* ============================================================
   Study Live — app.js
   Bootstrap: theme, i18n, onboarding, router, header actions.
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var u = SL.utils;

  SL.VERSION = '5.3.1';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#17140d' : '#f7f2e9');
  }

  function currentTheme() {
    var saved = SL.store.get().settings.theme;
    if (saved === 'light' || saved === 'dark') return saved;
    return root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  /* ---------- header ---------- */

  function buildHeader() {
    var header = u.$('.header');
    header.innerHTML =
      '<span class="brand">' +
      SL.ui.icon('logo', 24) +
      '<span class="name">Study Live</span></span>' +
      '<button class="icon-btn pill-btn" data-act="lang" aria-haspopup="menu">' +
      SL.ui.icon('globe', 18) +
      '<span class="icon-label" data-host="langname"></span></button>' +
      '<button class="icon-btn pill-btn" data-act="theme" aria-label="' + SL.i18n.t('hdr.theme') + '" data-host="themebtn"></button>' +
      '<div class="lang-menu" role="menu" data-host="langmenu"></div>';

    var menu = header.querySelector('[data-host="langmenu"]');
    var themeBtn = header.querySelector('[data-host="themebtn"]');

    function renderHeaderBits() {
      var lang = SL.LANGS.filter(function (l) {
        return l.code === SL.i18n.lang;
      })[0];
      header.querySelector('[data-host="langname"]').textContent = lang ? lang.code.toUpperCase() : '';
      themeBtn.innerHTML = SL.ui.icon(SL.store.get().settings.theme === 'dark' ? 'sun' : 'moon', 18);
    }

    function renderMenu() {
      menu.innerHTML = SL.LANGS.map(function (l) {
        return (
          '<button role="menuitemradio" aria-checked="' + (l.code === SL.i18n.lang) + '" data-lang="' + l.code + '">' +
          '<span>' + l.native + '</span>' +
          '<span class="check-ic">' + SL.ui.icon('check', 16) + '</span></button>'
        );
      }).join('');
      menu.querySelectorAll('[data-lang]').forEach(function (b) {
        b.addEventListener('click', function () {
          SL.i18n.setLang(b.getAttribute('data-lang'));
          menu.classList.remove('open');
          renderHeaderBits();
          renderMenu();
        });
      });
    }

    header.querySelector('[data-act="lang"]').addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target)) menu.classList.remove('open');
    });

    themeBtn.addEventListener('click', function () {
      var next = SL.store.get().settings.theme === 'dark' ? 'light' : 'dark';
      SL.store.setTheme(next);
      applyTheme(next);
      renderHeaderBits();
    });

    renderHeaderBits();
    renderMenu();
  }

  /* ---------- onboarding ---------- */

  function maybeOnboard(after) {
    if (SL.store.get().flags.onboarded) {
      after();
      return;
    }
    var chosenTheme = currentTheme();
    var overlay = document.createElement('div');
    overlay.className = 'onboard';
    overlay.innerHTML =
      '<div class="ob-card">' +
      '<div class="ob-logo">' + SL.ui.icon('logo', 54) + '</div>' +
      '<h1>' + SL.i18n.t('ob.welcome') + '</h1>' +
      '<p class="ob-tag">' + SL.i18n.t('ob.tag') + '</p>' +
      '<div class="ob-label">' + SL.i18n.t('ob.lang') + '</div>' +
      '<div class="lang-btns" data-host="langs"></div>' +
      '<div class="ob-label">' + SL.i18n.t('ob.theme') + '</div>' +
      '<div class="theme-btns" data-host="themes"></div>' +
      '<button class="btn btn-primary ob-start" data-act="start">' + SL.i18n.t('ob.start') + '</button>' +
      '</div>';

    var langs = overlay.querySelector('[data-host="langs"]');
    SL.LANGS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.native;
      b.setAttribute('aria-pressed', l.code === SL.i18n.lang ? 'true' : 'false');
      b.addEventListener('click', function () {
        SL.i18n.setLang(l.code, { silent: true });
        langs.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-pressed', 'false');
        });
        b.setAttribute('aria-pressed', 'true');
        // re-render onboarding copy in the chosen language
        overlay.querySelector('h1').textContent = SL.i18n.t('ob.welcome');
        overlay.querySelector('.ob-tag').textContent = SL.i18n.t('ob.tag');
        overlay.querySelector('.ob-label').textContent = SL.i18n.t('ob.lang');
        overlay.querySelectorAll('.ob-label')[1].textContent = SL.i18n.t('ob.theme');
        overlay.querySelector('[data-act="start"]').textContent = SL.i18n.t('ob.start');
      });
      langs.appendChild(b);
    });

    var themes = overlay.querySelector('[data-host="themes"]');
    [['light', 'ob.light', 'sun'], ['dark', 'ob.dark', 'moon']].forEach(function (pair) {
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = SL.ui.icon(pair[2], 17) + '<span>' + SL.i18n.t(pair[1]) + '</span>';
      b.setAttribute('aria-pressed', pair[0] === chosenTheme ? 'true' : 'false');
      b.addEventListener('click', function () {
        chosenTheme = pair[0];
        applyTheme(chosenTheme);
        SL.store.setTheme(chosenTheme);
        themes.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-pressed', 'false');
        });
        b.setAttribute('aria-pressed', 'true');
      });
      themes.appendChild(b);
    });

    overlay.querySelector('[data-act="start"]').addEventListener('click', function () {
      SL.store.setOnboarded();
      overlay.remove();
      after();
    });

    document.body.appendChild(overlay);
  }

  /* ---------- login gate (auth guard) ---------- */

  var GOOGLE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';

  function showLoginGate(after) {
    // Skip if Supabase is not configured (dev environment)
    if (!SL.supabase || !SL.supabase.ENABLED) {
      after();
      return;
    }

    // Check if already signed in
    SL.supabase.getSession().then(function (session) {
      if (session) {
        after();
        return;
      }
      renderGate();
    }).catch(function () {
      renderGate();
    });

    function renderGate() {
      var overlay = document.createElement('div');
      overlay.className = 'login-gate';
      overlay.innerHTML =
        '<div class="login-gate-card">' +
        '<div class="login-gate-icon">' + SL.ui.icon('cloud', 54) + '</div>' +
        '<div class="login-gate-title">' + u.esc(SL.i18n.t('cloud.loginTitle')) + '</div>' +
        '<div class="login-gate-sub">' + u.esc(SL.i18n.t('cloud.loginHint')) + '</div>' +
        '<button class="cloud-google-btn" data-act="glogin">' +
        GOOGLE_SVG + u.esc(SL.i18n.t('cloud.loginBtn')) + '</button>' +
        '<div class="login-gate-error" data-host="gerror"></div>' +
        '<div class="login-gate-footer">' + u.esc(SL.i18n.t('cloud.dataSafe')) + '</div>' +
        '</div>';

      var btn = overlay.querySelector('[data-act="glogin"]');
      var errEl = overlay.querySelector('[data-host="gerror"]');

      btn.addEventListener('click', function () {
        btn.disabled = true;
        errEl.textContent = '';
        SL.supabase.signInWithGoogle().catch(function () {
          errEl.textContent = SL.i18n.t('cloud.loginError');
          btn.disabled = false;
        });
      });

      // Listen for auth changes — if user signs in (e.g. redirect), remove gate
      if (SL.supabase.onAuthChange) {
        SL.supabase.onAuthChange(function (event, user) {
          if (user && overlay.parentNode) {
            overlay.remove();
            after();
          }
        });
      }

      document.body.appendChild(overlay);
    }
  }

  /* ---------- boot ---------- */

  function boot() {
    applyTheme(currentTheme());
    SL.i18n.init();
    applyTheme(currentTheme()); // theme may follow system before user choice

    SL.router.init(u.$('.main'), u.$('.bottom-nav'));
    // First 4 are primary, rest are secondary (hub menu)
    SL.router.register([
      SL.pages.overview, 
      SL.pages.tasks, 
      SL.pages.notes, 
      SL.pages.stats, 
      SL.pages.places,
      SL.pages.teachers,
      SL.pages.contacts,
      SL.pages.vault, 
      SL.pages.profile
    ]);

    buildHeader();

    maybeOnboard(function () {
      showLoginGate(function () {
        SL.router.go('overview');
        // re-render header labels in the resolved language
        buildHeader();
      });
    });

    // migrate legacy dataURL images into IndexedDB (no-op when fresh)
    SL.store.migrateImages();

    // offline support: register the service worker on http(s) only.
    // In dev (vite) we must NOT run a service worker — an old one would
    // keep serving stale assets and hide every code change. Instead we
    // actively unregister leftovers and wipe old caches.
    if (import.meta.env.DEV) {
      if (root.navigator && 'serviceWorker' in root.navigator) {
        root.navigator.serviceWorker.getRegistrations().then(function (regs) {
          regs.forEach(function (reg) {
            reg.unregister();
          });
        }).catch(function () {});
      }
      if (root.caches && root.caches.keys) {
        root.caches.keys().then(function (keys) {
          keys.forEach(function (key) {
            root.caches.delete(key);
          });
        }).catch(function () {});
      }
    } else if (root.navigator && 'serviceWorker' in root.navigator && /^https?:$/.test(root.location.protocol)) {
      root.navigator.serviceWorker.register('sw.js').catch(function () {});
      // when a new service worker takes over, reload once so updates reach the user
      var swReloaded = false;
      root.navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (swReloaded) return;
        swReloaded = true;
        root.location.reload();
      });
    }

    // re-render everything after language change
    SL.store.onChange(function () {
      /* pages re-render on their own actions; header labels update here */
    });

    // flush pending saves when the app goes to background / closes
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') SL.store.saveNow();
    });
    root.addEventListener('pagehide', function () {
      SL.store.saveNow();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);

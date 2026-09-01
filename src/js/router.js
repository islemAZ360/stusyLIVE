/* ============================================================
   Study Live — router.js
   Page registry + bottom nav + transitions.
   Re-renders the active page when the store changes, unless a
   sheet is open or the user is typing in a field on the page.
   Add a page: register({id,labelKey,icon,render}) — done.
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var registered = [];
  var currentId = null;
  var mainEl = null;
  var navEl = null;
  var sectionEls = {};

  function ensureSection(page) {
    if (!sectionEls[page.id]) {
      var sec = document.createElement('section');
      sec.className = 'page';
      sec.id = 'page-' + page.id;
      mainEl.appendChild(sec);
      sectionEls[page.id] = sec;
    }
    return sectionEls[page.id];
  }

  function renderNav() {
    var primaries = registered.slice(0, 4);
    var secondaries = registered.slice(4);

    var html = '';
    
    // First 2
    primaries.slice(0, 2).forEach(function(p) {
      html += '<button class="nav-tab" data-page="' + p.id + '" aria-current="' +
          (p.id === currentId ? 'page' : 'false') + '">' +
          '<span class="nav-dot" aria-hidden="true"></span>' +
          SL.ui.icon(p.icon, 21) +
          '<span>' + SL.utils.esc(SL.i18n.t(p.labelKey)) + '</span></button>';
    });

    // Center Hub Button
    html += '<button class="nav-hub-btn" aria-haspopup="menu" aria-label="' + SL.utils.esc(SL.i18n.t('a.more') || 'المزيد') + '">' +
            '<div class="hub-icon-wrap">' + SL.ui.icon('logo', 24) + '</div></button>';

    // Last 2
    primaries.slice(2, 4).forEach(function(p) {
      html += '<button class="nav-tab" data-page="' + p.id + '" aria-current="' +
          (p.id === currentId ? 'page' : 'false') + '">' +
          '<span class="nav-dot" aria-hidden="true"></span>' +
          SL.ui.icon(p.icon, 21) +
          '<span>' + SL.utils.esc(SL.i18n.t(p.labelKey)) + '</span></button>';
    });

    navEl.innerHTML = html;

    navEl.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        go(btn.getAttribute('data-page'));
      });
    });
    
    var hubBtn = navEl.querySelector('.nav-hub-btn');
    if (hubBtn) {
      hubBtn.addEventListener('click', function() {
        showHubMenu(secondaries);
      });
    }
  }

  function showHubMenu(secondaries) {
    var scrim = document.createElement('div');
    scrim.className = 'hub-popover-scrim';
    
    var popover = document.createElement('div');
    popover.className = 'hub-popover';
    
    var menuHtml = '<div class="hub-menu-grid">';
    secondaries.forEach(function(p) {
      menuHtml += '<button class="hub-menu-item" data-page="' + p.id + '">' +
                  '<div class="icon-wrap">' + SL.ui.icon(p.icon, 24) + '</div>' +
                  '<span>' + SL.utils.esc(SL.i18n.t(p.labelKey)) + '</span></button>';
    });
    menuHtml += '</div>';
    
    popover.innerHTML = menuHtml;
    
    document.body.appendChild(scrim);
    document.body.appendChild(popover);
    
    function closePopover() {
      scrim.classList.remove('open');
      popover.classList.remove('open');
      setTimeout(function() {
        scrim.remove();
        popover.remove();
      }, 300);
    }
    
    scrim.addEventListener('click', closePopover);
    
    popover.querySelectorAll('.hub-menu-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        go(btn.getAttribute('data-page'));
        closePopover();
      });
    });
    
    // trigger animation
    requestAnimationFrame(function() {
      scrim.classList.add('open');
      popover.classList.add('open');
    });
  }

  function updateFab(page) {
    var fab = document.querySelector('.fab');
    if (!fab) return;
    var def = page.getFab ? page.getFab() : null;
    if (def) {
      fab.hidden = false;
      fab.style.display = 'flex'; // inline style wins over any CSS, even where [hidden] support is odd
      fab.innerHTML = SL.ui.icon('plus', 24);
      fab.setAttribute('aria-label', SL.i18n.t(def.labelKey));
      fab.onclick = function () {
        def.action();
      };
    } else {
      fab.hidden = true;
      fab.style.display = 'none';
      fab.onclick = null;
    }
  }

  function go(id) {
    var page = registered.filter(function (p) {
      return p.id === id;
    })[0];
    if (!page) return;

    // let the outgoing page clean up (e.g. the vault re-locks)
    var prev = registered.filter(function (p) {
      return p.id === currentId;
    })[0];
    if (prev && typeof prev.onLeave === 'function') prev.onLeave();

    var prevIndex = registered.findIndex(function (p) {
      return p.id === currentId;
    });
    var nextIndex = registered.findIndex(function (p) {
      return p.id === id;
    });
    var dirClass = nextIndex > prevIndex ? 'from-next' : 'from-prev';

    registered.forEach(function (p) {
      sectionEls[p.id].classList.remove('active', 'from-next', 'from-prev');
    });

    currentId = id;
    var sec = ensureSection(page);
    page.render(sec, true);
    sec.classList.add('active', dirClass);

    updateFab(page);
    window.scrollTo({ top: 0 });
    renderNav();
  }

  /*
   * Silent re-render (data changed). Skipped while a sheet is open
   * or while the user is typing inside the page — those flows call
   * render explicitly; the sheet-close path re-renders afterwards.
   */
  function rerenderAll() {
    if (!currentId || !navEl) return;
    if (SL.ui.hasOpenSheet && SL.ui.hasOpenSheet()) return;
    var ae = document.activeElement;
    if (
      ae &&
      mainEl.contains(ae) &&
      /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) &&
      (ae.offsetWidth > 0 || ae.offsetHeight > 0 || ae.getClientRects().length > 0)
    ) {
      return; // the user is literally typing in the visible field — don't yank it
    }
    var page = registered.filter(function (p) {
      return p.id === currentId;
    })[0];
    if (page) {
      page.render(sectionEls[page.id], false);
      updateFab(page);
      renderNav();
    }
  }

  SL.router = {
    register: function (pages) {
      registered = pages.slice();
      registered.forEach(ensureSection);
      renderNav();
      SL.store.onChange(rerenderAll);
    },
    go: go,
    rerenderAll: rerenderAll,
    updateFab: updateFab,
    refresh: function () {
      rerenderAll();
    },
    current: function () {
      return currentId;
    },
    init: function (main, nav) {
      mainEl = main;
      navEl = nav;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

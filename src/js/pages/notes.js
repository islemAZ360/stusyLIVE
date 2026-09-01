/* ============================================================
   Study Live — pages/notes.js
   Search + subject filter + sticky-note grid + editor.
   Notes of one subject share its color in 4 tint shades.
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var u = SL.utils;
  var t = function (k, v) {
    return SL.i18n.t(k, v);
  };

  var filter = { q: '', subjectId: undefined }; // undefined = all

  function noteMatches(n) {
    if (filter.subjectId !== undefined && (n.subjectId || null) !== filter.subjectId) return false;
    if (filter.q) {
      var q = filter.q.toLowerCase();
      var hay = ((n.title || '') + ' ' + (n.text || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function cardHTML(n, all) {
    var s = n.subjectId ? SL.store.subjectById(n.subjectId) : null;
    var color = s ? s.color : 'var(--warn)';
    var shade = s ? ' shade-' + u.shadeIndex(n, all) : '';
    var tilt = u.tiltFor(n.id);
    var thumbs = n.images
      .slice(0, 3)
      .map(function (entry) {
        if (typeof entry === 'string' && /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(entry)) {
          /* only strictly-valid base64 image data URLs are embedded;
             anything else (incl. crafted 'data:...onerror=...') is dropped */
          return '<img src="' + entry + '" alt="" loading="lazy" decoding="async">';
        }
        return '<span class="img-ph" data-img-id="' + u.esc(entry) + '"></span>';
      })
      .join('');
    var extra = n.images.length > 3 ? '<span class="more-img">+' + (n.images.length - 3) + '</span>' : '';
    return (
      '<button type="button" class="sticky' + shade + (n.pinned ? ' pinned' : '') + '" data-id="' + n.id + '" style="--c:' + u.esc(color) +
      ';--tilt:' + tilt + '">' +
      '<span class="pin-flag" aria-hidden="true">' + SL.ui.icon('bookmark', 13) + '</span>' +
      (n.title ? '<div class="n-title">' + u.esc(n.title) + '</div>' : '') +
      (n.text ? '<div class="n-text">' + u.esc(n.text) + '</div>' : '') +
      (n.images.length
        ? '<div class="n-imgs">' + thumbs + extra + '</div>'
        : '') +
      '<div class="n-foot">' +
      (s
        ? '<span class="dot" style="width:8px;height:8px;border-radius:50%;background:' +
          u.esc(s.color) + ';flex-shrink:0"></span><span>' + u.esc(s.name) + '</span>'
        : '<span>' + u.esc(t('n.noSubject')) + '</span>') +
      '<span class="n-line"></span><span>' + u.esc(u.fmtDateShort(u.ymd(new Date(n.updatedAt || Date.now())), SL.i18n.lang)) + '</span>' +
      '</div></button>'
    );
  }

  function render(root2, animate) {
    var st = SL.store.get();
    var notes = st.notes.filter(noteMatches).slice().sort(function (a, b) {
      return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    var subjects = SL.store.currentSemesterSubjects();

    root2.innerHTML =
      '<h1 class="page-title">' + u.esc(t('n.title')) + '</h1>' +
      '<div class="notes-tools">' +
      '<div class="search-wrap">' + SL.ui.icon('search', 17) +
      '<input class="input" type="search" data-act="q" value="' + u.esc(filter.q) + '" ' +
      'placeholder="' + u.esc(t('n.searchPh')) + '" aria-label="' + u.esc(t('a.search')) + '"></div>' +
      '<div class="chips-row scroll" data-host="filters"></div>' +
      '<button type="button" class="btn btn-primary notes-new-btn only-desktop" data-act="new">' +
      SL.ui.icon('plus', 17) + u.esc(t('n.new')) + '</button>' +
      '</div>' +
      '<div data-host="grid" class="notes-grid"></div>';

    // filter chips
    var fHost = root2.querySelector('[data-host="filters"]');
    function fchip(label, val, color) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.innerHTML = color ? '<span class="dot"></span>' : '';
      var sp = document.createElement('span');
      sp.textContent = label;
      b.appendChild(sp);
      if (color) b.querySelector('.dot').style.background = color;
      var active = filter.subjectId === val;
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) {
        b.style.borderColor = 'var(--accent)';
        b.style.color = 'var(--ink)';
      }
      b.addEventListener('click', function () {
        filter.subjectId = val;
        render(root2);
      });
      fHost.appendChild(b);
    }
    fchip(t('n.filterAll'), undefined, null);
    fchip(t('n.filterNone'), null, null);
    subjects.forEach(function (s) {
      fchip(s.name, s.id, s.color);
    });

    var grid = root2.querySelector('[data-host="grid"]');
    if (!st.notes.length) {
      grid.classList.add('grid-empty');
      grid.innerHTML =
        '<div class="empty">' + SL.ui.icon('notes', 40) +
        '<div class="e-title">' + u.esc(t('n.empty')) + '</div>' +
        '<div class="e-hint">' + u.esc(t('n.emptyHint')) + '</div>' +
        '<button class="btn btn-primary" data-act="new">' + SL.ui.icon('plus', 17) + u.esc(t('n.new')) + '</button></div>';
    } else if (!notes.length) {
      grid.classList.add('grid-empty');
      grid.innerHTML =
        '<div class="empty">' + SL.ui.icon('search', 40) +
        '<div class="e-title">' + u.esc(t('n.noResults')) + '</div>' +
        '<div class="e-hint">' + u.esc(t('n.noResultsHint')) + '</div></div>';
    } else {
      grid.classList.remove('grid-empty');
      if (animate !== false) grid.classList.add('stagger');
      grid.innerHTML = notes
        .map(function (n) {
          return cardHTML(n, st.notes);
        })
        .join('');
      SL.ui.hydrateImages(grid);
    }

    // search
    var q = root2.querySelector('[data-act="q"]');
    q.addEventListener('input', u.debounce(function () {
      filter.q = q.value.trim();
      var grid2 = root2.querySelector('[data-host="grid"]');
      grid2.classList.remove('stagger');
      var notes2 = SL.store.get().notes.filter(noteMatches);
      if (!SL.store.get().notes.length) return; // empty state already rendered
      if (!notes2.length) {
        grid2.classList.add('grid-empty');
        grid2.innerHTML =
          '<div class="empty">' + SL.ui.icon('search', 40) +
          '<div class="e-title">' + u.esc(t('n.noResults')) + '</div>' +
          '<div class="e-hint">' + u.esc(t('n.noResultsHint')) + '</div></div>';
      } else {
        grid2.classList.remove('grid-empty');
        grid2.innerHTML = notes2
          .map(function (n) {
            return cardHTML(n, SL.store.get().notes);
          })
          .join('');
        SL.ui.hydrateImages(grid2);
      }
    }, 160));

    // actions (delegation re-bound safely on every render)
    if (root2._onClick) root2.removeEventListener('click', root2._onClick);
    root2._onClick = function (e) {
      if (e.target.closest('[data-act="new"]')) {
        SL.ui.openNoteForm({});
        return;
      }
      var card = e.target.closest('.sticky[data-id]');
      if (card) {
        var note = SL.store
          .get()
          .notes.filter(function (n) {
            return n.id === card.getAttribute('data-id');
          })[0];
        if (note) SL.ui.openNoteForm({ note: note });
      }
    };
    root2.addEventListener('click', root2._onClick);
  }

  SL.pages = SL.pages || {};
  SL.pages.notes = {
    id: 'notes',
    labelKey: 'nav.notes',
    icon: 'notes',
    render: render,
    getFab: function () {
      return {
        labelKey: 'n.new',
        action: function () {
          SL.ui.openNoteForm({});
        },
      };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

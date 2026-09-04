/* ============================================================
   Study Live — components.js
   Icons, bottom sheets, toasts, confirm dialogs, palette picker,
   subject manager, task form, note form.
   Depends on: utils.js, strings.js, i18n.js, store.js
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var u = SL.utils;
  var t = function (k, v) {
    return SL.i18n.t(k, v);
  };

  /* Subject palette — 12 stationery colors (Radix-derived) */
  SL.PALETTE = [
    '#e5484d',
    '#f76b15',
    '#ffb224',
    '#eac54f',
    '#9bbf30',
    '#46a758',
    '#12a594',
    '#0ea5c6',
    '#0090ff',
    '#3e63dd',
    '#6e56cf',
    '#d6409f',
  ];

  /* ---------- Icons (monoline SVG, currentColor) ---------- */

  var ICONS = {
    logo:
      '<rect x="4.5" y="3" width="15" height="18" rx="3"/><path d="M8.5 3v18"/><path d="M13.5 3v5.5l1.8-1.4 1.8 1.4V3"/>',
    tasks:
      '<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M9 14.8l2 2 3.8-3.8"/>',
    notes:
      '<path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8.5L14.5 19H7a2 2 0 0 1-2-2z"/><path d="M19 13.5h-4.5V19"/><path d="M8.5 9h7"/><path d="M8.5 12.5h4"/>',
    profile:
      '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c1.2-3.4 3.9-5 7-5s5.8 1.6 7 5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    chevL: '<path d="M14.5 6l-6 6 6 6"/>',
    chevR: '<path d="M9.5 6l6 6-6 6"/>',
    sun:
      '<circle cx="12" cy="12" r="3.6"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
    moon: '<path d="M20 13.5A8 8 0 0 1 10.5 4 7.2 7.2 0 1 0 20 13.5z"/>',
    globe:
      '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.3 3.8 5 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5-3.8-8.5s1.3-6.2 3.8-8.5z"/>',
    trash:
      '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V5A1.5 1.5 0 0 1 11 3.5h2A1.5 1.5 0 0 1 14.5 5v1.5"/><path d="M6.5 6.5l.9 13.1a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13.1"/><path d="M10 10.5v6M14 10.5v6"/>',
    pencil:
      '<path d="M4.5 19.5l.9-3.6L16.7 4.6a1.84 1.84 0 0 1 2.6 0l.1.1a1.84 1.84 0 0 1 0 2.6L8.1 18.6z"/><path d="M14.9 6.4l2.7 2.7"/>',
    image:
      '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 15.5l-4-4-7 8"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    tag:
      '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h5.2c.4 0 .78.16 1.06.44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-5.2 5.2a1.5 1.5 0 0 1-2.12 0l-7.3-7.3A1.5 1.5 0 0 1 4 10.7z"/><circle cx="8.5" cy="8.5" r="1.3"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 20h14"/>',
    upload: '<path d="M12 15V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M5 20h14"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    bookmark: '<path d="M6 5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V20l-6-3.4L6 20z"/>',
    alert:
      '<path d="M10.3 5.2L3.2 17.5a2 2 0 0 0 1.7 3h14.2a2 2 0 0 0 1.7-3L13.7 5.2a2 2 0 0 0-3.4 0z"/><path d="M12 10v4"/><path d="M12 17v.2"/>',
    lock:
      '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    eye:
      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff:
      '<path d="M2.5 12S6 5.5 12 5.5c1.7 0 3.2.5 4.5 1.2M21.5 12s-3.5 6.5-9.5 6.5c-1.7 0-3.2-.5-4.5-1.2"/><path d="M4 4l16 16"/><circle cx="12" cy="12" r="2.8"/>',
    copy:
      '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15h-.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>',
    mapPin:
      '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    navigate:
      '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    graduation:
      '<path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V12"/><path d="M22 10v6"/>',
    chart:
      '<path d="M4 20V10"/><path d="M9 20V6"/><path d="M14 20V12"/><path d="M19 20V4"/>',
    medal:
      '<circle cx="12" cy="8" r="5"/><path d="M8.5 12.5L7 20l5-2 5 2-1.5-7.5"/><path d="M12 5v6"/><path d="M9 8h6"/>',
    trophy:
      '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v3c0 3.3-2.2 6-5 6s-5-2.7-5-6z"/><path d="M7 7H4v1c0 2.2 1.3 3 3 3"/><path d="M17 7h3v1c0 2.2-1.3 3-3 3"/>',
    fire:
      '<path d="M12 2c1 4-2 6-2 10a4 4 0 0 0 8 0c0-4.5-3.5-5-3.5-10"/><path d="M10 16a2 2 0 0 0 4 0c0-2-2-2.5-2-5"/>',
    star:
      '<path d="M12 2l2.9 5.8L21 9l-4.5 4.4L17.8 20 12 17l-5.8 3 1.3-6.6L3 9l6.1-1.2z"/>',
    phone:
      '<path d="M5.5 4h3l1.7 4.2-2.1 1.6a12.5 12.5 0 0 0 6.1 6.1l1.6-2.1 4.2 1.7v3a1.5 1.5 0 0 1-1.6 1.5C10.5 19.4 4.6 13.5 4 5.6A1.5 1.5 0 0 1 5.5 4z"/>',
    mail:
      '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/>',
    users:
      '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c1-3 3.2-4.5 5.5-4.5s4.5 1.5 5.5 4.5"/><circle cx="16.8" cy="9.5" r="2.6"/><path d="M16.5 14.7c2 .3 3.5 1.6 4.2 4.3"/>',
    cloud:
      '<path d="M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.7-1.5A4 4 0 0 1 17 18z"/>',
    sync:
      '<path d="M19 13a7 7 0 0 1-11.5 5.4"/><path d="M5 11a7 7 0 0 1 11.5-5.4"/><path d="M16.5 2.5V7h-4.5"/><path d="M7.5 21.5V17H12"/>',
    logout:
      '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 7l-3 5 3 5"/><path d="M7 12h9"/>',
  };

  function icon(name, size) {
    size = size || 20;
    return (
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +
      (ICONS[name] || '') +
      '</svg>'
    );
  }

  /* ---------- Toast ---------- */

  var toastWrap = null;

  function toast(msg, type) {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'toast-wrap';
      document.body.appendChild(toastWrap);
    }
    var el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = msg;
    toastWrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('leaving');
      setTimeout(function () {
        el.remove();
      }, 260);
    }, 2400);
  }

  /* ---------- Bottom sheet ---------- */

  var openSheets = [];

  function closeTopSheet() {
    if (openSheets.length) openSheets[openSheets.length - 1].close();
  }

  function openSheet(opts) {
    var scrim = document.createElement('div');
    scrim.className = 'sheet-scrim';
    var sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', opts.title || '');
    sheet.innerHTML =
      '<div class="sheet-grab" aria-hidden="true"></div>' +
      '<div class="sheet-head"><h2></h2><button class="icon-btn" data-close aria-label="' +
      u.esc(t('a.close')) + '">' + icon('x') + '</button></div>' +
      '<div class="sheet-body"></div>' +
      (opts.footHTML ? '<div class="sheet-foot">' + opts.footHTML + '</div>' : '');
    sheet.querySelector('.sheet-head h2').textContent = opts.title || '';

    var lastFocus = document.activeElement;
    document.body.appendChild(scrim);
    document.body.appendChild(sheet);

    var body = sheet.querySelector('.sheet-body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    var handle = {
      el: sheet,
      bodyEl: body,
      closed: false,
      close: function () {
        if (handle.closed) return;
        handle.closed = true;
        sheet.classList.remove('open');
        scrim.classList.remove('open');
        setTimeout(function () {
          scrim.remove();
          sheet.remove();
          openSheets = openSheets.filter(function (h) {
            return h !== handle;
          });
          if (lastFocus && lastFocus.focus) lastFocus.focus();
          if (opts.onClose) opts.onClose();
          if (SL.router && SL.router.rerenderAll) SL.router.rerenderAll();
        }, 290);
      },
    };

    openSheets.push(handle);

    sheet.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) handle.close();
    });
    scrim.addEventListener('click', function () {
      handle.close();
    });

    // focus trap
    sheet.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        handle.close();
        return;
      }
      if (e.key !== 'Tab') return;
      var focusables = u.$$(
        'button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
        sheet
      ).filter(function (el) {
        return !el.disabled && el.offsetParent !== null;
      });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    requestAnimationFrame(function () {
      scrim.classList.add('open');
      sheet.classList.add('open');
      var target =
        body.querySelector('input:not([type="hidden"]), textarea, select') ||
        body.querySelector('button');
      if (target && opts.autofocus !== false) target.focus();
    });

    return handle;
  }

  /* ---------- Confirm ---------- */

  function confirmSheet(opts) {
    return new Promise(function (resolve) {
      var body = document.createElement('div');
      body.innerHTML =
        '<p style="color:var(--ink-muted);font-size:14px;margin:0 0 4px">' +
        u.esc(opts.message || '') +
        '</p>';
      var foot =
        '<button class="btn btn-ghost" data-x="no"></button>' +
        '<button class="btn ' +
        (opts.danger ? 'btn-danger' : 'btn-primary') +
        '" data-x="yes"></button>';
      var h = openSheet({
        title: opts.title,
        body: body,
        footHTML: foot,
        autofocus: false,
        onClose: function () {
          resolve(false);
        },
      });
      var noBtn = h.el.querySelector('[data-x="no"]');
      var yesBtn = h.el.querySelector('[data-x="yes"]');
      noBtn.textContent = opts.cancelLabel || t('a.cancel');
      yesBtn.textContent = opts.confirmLabel || t('a.delete');
      /* Cancel: just close — onClose resolves(false).
         Confirm: resolve(true) FIRST, then close (the second
         resolve from onClose is ignored by the promise). */
      noBtn.addEventListener('click', function () {
        h.close();
      });
      yesBtn.addEventListener('click', function () {
        resolve(true);
        h.close();
      });
      setTimeout(function () {
        yesBtn.focus();
      }, 60);
    });
  }

  /* ---------- Palette picker ---------- */

  function pickColor(current, onPick) {
    var body = document.createElement('div');
    var grid = document.createElement('div');
    grid.className = 'palette';
    SL.PALETTE.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.style.background = c;
      b.setAttribute('aria-label', c);
      b.setAttribute('aria-pressed', c === current ? 'true' : 'false');
      b.addEventListener('click', function () {
        onPick(c);
        h.close();
      });
      grid.appendChild(b);
    });
    body.appendChild(grid);
    var h = openSheet({ title: t('s.color'), body: body, autofocus: false });
    return h;
  }

  /* ---------- Teacher picker (subject <-> teacher link) ---------- */

  function openTeacherPicker(subject, onPick) {
    var teachers = SL.store.teachers();
    var body = document.createElement('div');
    body.className = 'teacher-picker';

    if (!teachers.length) {
      body.innerHTML =
        '<div class="empty">' +
        icon('graduation', 40) +
        '<div class="e-title">' + u.esc(t('th.empty')) + '</div>' +
        '<div class="e-hint">' + u.esc(t('th.emptyHint')) + '</div></div>' +
        '<button class="btn btn-primary" data-host="go-add" style="margin-top:12px">' +
        u.esc(t('th.add')) + '</button>';
    } else {
      var list = document.createElement('div');
      list.innerHTML =
        '<button class="teacher-picker-item" data-val="" style="flex:1 0 100%">' +
        '<span class="tp-av" style="background:var(--surface-3)">×</span>' +
        '<span>' + u.esc(t('s.noTeacher')) + '</span></button>' +
        teachers
          .map(function (te) {
            var av = te.photo
              ? (isImgIdLike(te.photo)
                  ? '<span class="tp-av tp-img-ph" data-img-id="' + u.esc(te.photo) + '"></span>'
                  : '<img class="tp-av" src="' + u.esc(te.photo) + '" alt="">')
              : '<span class="tp-av" style="background:' + (te.name || '?').charAt(0).toUpperCase() + '"></span>';
            return (
              '<button class="teacher-picker-item" data-val="' + u.esc(te.id) + '">' +
              av +
              '<span>' + u.esc(te.name) + '</span></button>'
            );
          })
          .join('');
      body.appendChild(list);
    }

    var h = openSheet({
      title: t('s.teacher'),
      body: body,
      footHTML:
        '<button class="btn btn-primary" data-host="pick" hidden>' + u.esc(t('a.save')) + '</button>' +
        '<button class="btn btn-ghost" data-host="cancel">' + u.esc(t('a.close')) + '</button>',
    });

    body.addEventListener('click', function (e) {
      var goAdd = e.target.closest('[data-host="go-add"]');
      if (goAdd) {
        h.close();
        if (root.SL && SL.router) SL.router.go('teachers');
        return;
      }
      var item = e.target.closest('.teacher-picker-item');
      if (item) {
        var val = item.getAttribute('data-val');
        var found = val ? (SL.store.teacherById(val) || null) : null;
        onPick(found);
        h.close();
      }
    });

    h.el.querySelector('[data-host="cancel"]').addEventListener('click', function () {
      h.close();
    });

    SL.ui.hydrateImages(body);
  }

  function isImgIdLike(v) {
    return typeof v === 'string' && v !== 'data:' && !/^data:/.test(v);
  }

  /* ---------- Subject manager (shared) ---------- */

  function openSubjectManager(semesterId) {
    var h = null;
    var newColor = SL.PALETTE[0];

    function semesterLabel() {
      var found = SL.store._findSem(semesterId);
      if (!found) return '';
      return SL.i18n.semName(found.semIndex + 1) + ' — ' + SL.i18n.yearName(found.yearIndex + 1);
    }

    function rowHTML(s) {
      var teacher = s.teacherId ? SL.store.teacherById(s.teacherId) : null;
      var badge = '';
      if (teacher) {
        badge =
          '<span class="subj-teacher-chip" title="' + u.esc(t('s.teacher')) + '">' +
          '<span class="subj-teacher-av">' + teacher.name.charAt(0).toUpperCase() + '</span>' +
          u.esc(teacher.name) + '</span>';
      }
      return (
        '<div class="subject-row" data-id="' + s.id + '">' +
        '<button class="swatch" data-act="color" style="--c:' + u.esc(s.color) +
        '" aria-label="' + u.esc(t('s.color')) + '"></button>' +
        '<span class="s-name">' + u.esc(s.name) + '</span>' +
        badge +
        '<span class="s-actions">' +
        '<button class="mini-btn" data-act="teacher" aria-label="' + u.esc(t('s.teacher')) + '">' +
        icon('graduation', 18) + '</button>' +
        '<button class="mini-btn" data-act="edit" aria-label="' + u.esc(t('a.edit')) + '">' +
        icon('pencil', 18) + '</button>' +
        '<button class="mini-btn danger" data-act="del" aria-label="' + u.esc(t('a.delete')) + '">' +
        icon('trash', 18) + '</button>' +
        '</span></div>'
      );
    }

    function render() {
      var body = h.bodyEl;
      body.innerHTML = '';

      var subs = SL.store.subjectsOf(semesterId);

      // add form
      var addCard = document.createElement('div');
      addCard.className = 'subject-row';
      addCard.style.borderBottom = '1px dashed var(--border)';
      addCard.innerHTML =
        '<button class="swatch" data-act="new-color" style="--c:' + newColor +
        '" aria-label="' + u.esc(t('s.color')) + '"></button>' +
        '<input class="input" data-act="new-name" style="flex:1;min-height:42px" ' +
        'placeholder="' + u.esc(t('s.namePh')) + '" aria-label="' + u.esc(t('s.name')) + '">' +
        '<button class="btn btn-primary" data-act="new-add" style="min-height:42px;padding:8px 14px">' +
        icon('plus', 18) + '</button>';
      body.appendChild(addCard);

      if (!subs.length) {
        var empty = document.createElement('div');
        empty.className = 'empty';
        empty.innerHTML =
          icon('tag', 40) +
          '<div class="e-title">' + u.esc(t('s.empty')) + '</div>' +
          '<div class="e-hint">' + u.esc(t('s.emptyHint')) + '</div>';
        body.appendChild(empty);
      } else {
        var list = document.createElement('div');
        list.innerHTML = subs.map(rowHTML).join('');
        body.appendChild(list);
      }
    }

    h = openSheet({ title: t('s.forSem', { sem: semesterLabel() }), body: '' });

    h.bodyEl.addEventListener('click', function (e) {
      var addCard = e.target.closest('[data-act="new-color"]');
      if (addCard) {
        pickColor(newColor, function (c) {
          newColor = c;
          var sw = h.bodyEl.querySelector('[data-act="new-color"]');
          if (sw) sw.style.setProperty('--c', c);
        });
        return;
      }
      var addBtn = e.target.closest('[data-act="new-add"]');
      if (addBtn) {
        var input = h.bodyEl.querySelector('[data-act="new-name"]');
        var name = (input.value || '').trim();
        if (!name) {
          input.focus();
          return;
        }
        SL.store.addSubject(semesterId, name, newColor);
        newColor = SL.PALETTE[(SL.PALETTE.indexOf(newColor) + 1) % SL.PALETTE.length];
        render();
        toast(t('toast.saved'));
        return;
      }
      var row = e.target.closest('.subject-row[data-id]');
      if (!row) return;
      var id = row.getAttribute('data-id');
      var s = SL.store.subjectById(id);
      if (!s) return;
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.getAttribute('data-act');

      if (a === 'color') {
        pickColor(s.color, function (c) {
          SL.store.updateSubject(id, { color: c });
          render();
        });
      } else if (a === 'edit') {
        // swap name span into an input
        var nameEl = row.querySelector('.s-name');
        var input = document.createElement('input');
        input.className = 'input';
        input.style.cssText = 'flex:1;min-height:40px';
        input.value = s.name;
        input.setAttribute('aria-label', t('s.name'));
        nameEl.replaceWith(input);
        input.focus();
        input.select();
        var commit = function () {
          var v = input.value.trim();
          if (v) SL.store.updateSubject(id, { name: v });
          render();
        };
        input.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') commit();
          if (ev.key === 'Escape') render();
        });
        input.addEventListener('blur', function () {
          setTimeout(commit, 120);
        });
      } else if (a === 'del') {
        confirmSheet({
          title: t('s.deleteQ', { name: s.name }),
          message: t('s.deleteHint'),
          danger: true,
        }).then(function (yes) {
          if (yes) {
            SL.store.deleteSubject(id);
            render();
            toast(t('toast.deleted'));
          }
        });
      } else if (a === 'teacher') {
        openTeacherPicker(s, function (teacher) {
          if (teacher) {
            SL.store.updateSubject(id, { teacherId: teacher.id });
            toast(t('toast.saved'));
          } else {
            SL.store.updateSubject(id, { teacherId: null });
            toast(t('toast.saved'));
          }
          render();
        });
      }
    });

    h.bodyEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches('[data-act="new-name"]')) {
        h.bodyEl.querySelector('[data-act="new-add"]').click();
      }
    });

    render();
    return h;
  }

  /* ---------- Note image hydration (async image ids -> <img>) ---------- */

  function isDataUrl(entry) {
    return typeof entry === 'string' && entry.slice(0, 5) === 'data:';
  }

  /* Replaces [data-img-id] placeholders inside host with <img>.
   dataURL entries are rendered directly by callers. */
  function hydrateImages(host) {
    if (!host) return Promise.resolve();
    var placeholders = u.$$('[data-img-id]', host);
    if (!placeholders.length) return Promise.resolve();
    return Promise.all(
      placeholders.map(function (ph) {
        var id = ph.getAttribute('data-img-id');
        return SL.db
          .urlFor(id)
          .then(function (url) {
            if (!url) {
              ph.remove();
              return;
            }
            var img = document.createElement('img');
            /* carry the placeholder's class over so avatars/cards keep
               their circular sizing (av-img-ph, contact-avatar, tp-av…) */
            img.className = ph.getAttribute('class') || '';
            img.src = url;
            img.alt = '';
            img.decoding = 'async';
            img.loading = 'lazy';
            ph.replaceWith(img);
          })
          .catch(function () {
            ph.remove();
          });
      })
    ).then(function () {});
  }

  /* ---------- Segmented difficulty ---------- */

  function segmentedDiff(selected) {
    var wrap = document.createElement('div');
    wrap.className = 'segmented';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', t('t.difficulty'));
    [
      ['hard', t('t.diffHard')],
      ['easy', t('t.diffEasy')],
      ['light', t('t.diffLight')],
    ].forEach(function (pair) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = pair[1];
      b.setAttribute('aria-pressed', pair[0] === selected ? 'true' : 'false');
      b.dataset.val = pair[0];
      b.addEventListener('click', function () {
        u.$$('button', wrap).forEach(function (x) {
          x.setAttribute('aria-pressed', 'false');
        });
        b.setAttribute('aria-pressed', 'true');
      });
      wrap.appendChild(b);
    });
    wrap.getSelected = function () {
      var b = u.$$('button', wrap).filter(function (x) {
        return x.getAttribute('aria-pressed') === 'true';
      })[0];
      return b ? b.dataset.val : 'light';
    };
    return wrap;
  }

  /* ---------- Subject chips selector ---------- */

  function subjectChips(selectedId) {
    var wrap = document.createElement('div');
    wrap.className = 'chips-row';
    var subjects = SL.store.currentSemesterSubjects();

    function chip(label, val, color) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.innerHTML = color ? '<span class="dot"></span>' : '';
      var span = document.createElement('span');
      span.textContent = label;
      b.appendChild(span);
      if (color) b.querySelector('.dot').style.background = color;
      b.setAttribute('aria-pressed', selectedId === val ? 'true' : 'false');
      b.addEventListener('click', function () {
        selectedId = val;
        u.$$('.chip', wrap).forEach(function (x) {
          x.setAttribute('aria-pressed', 'false');
        });
        b.setAttribute('aria-pressed', 'true');
      });
      wrap.appendChild(b);
    }

    chip(t('t.noSubject'), null, null);
    subjects.forEach(function (s) {
      chip(s.name, s.id, s.color);
    });

    wrap.getSelected = function () {
      return selectedId;
    };
    wrap.isEmpty = function () {
      return !subjects.length;
    };
    return wrap;
  }

  /* ---------- Task form ---------- */

  function openTaskForm(opts) {
    opts = opts || {};
    var task = opts.task || null;
    var date = task ? task.date : opts.date || u.todayStr();
    var editing = !!task;

    var body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><label for="tf-title">' + u.esc(t('t.taskTitle')) + '</label>' +
      '<input class="input" id="tf-title" maxlength="140" value="' + u.esc(task ? task.title : '') +
      '" placeholder="' + u.esc(t('t.taskTitlePh')) + '">' +
      '<span class="field-error" role="alert" hidden></span></div>' +
      '<div class="field"><label for="tf-desc">' + u.esc(t('t.desc')) + '</label>' +
      '<textarea class="textarea compact" id="tf-desc" rows="3" placeholder="' + u.esc(t('t.descPh')) + '">' +
      u.esc(task && task.description ? task.description : '') +
      '</textarea></div>' +
      '<div class="field">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<label for="tf-date" style="margin-bottom:0">' + u.esc(t('t.date')) + '</label>' +
      '<div style="display:flex;align-items:center;gap:6px">' +
      '<span style="font-size:13px;color:var(--ink-muted)">' + u.esc(t('t.openDate')) + '</span>' +
      '<button type="button" id="tf-open-date" class="pin-toggle' + (!date ? ' on' : '') + '" aria-pressed="' + (!date ? 'true' : 'false') + '"><span class="pin-knob"></span></button>' +
      '</div></div>' +
      '<input class="input" id="tf-date" type="date" value="' + (date || u.todayStr()) + '" ' + (!date ? 'disabled style="opacity:0.5"' : '') + '></div>' +
      '<div class="field"><label>' + u.esc(t('t.difficulty')) + '</label><div data-host="diff"></div></div>' +
      '<div class="field"><label>' + u.esc(t('t.enableProgress')) + '</label>' +
      '<button type="button" id="tf-pen" class="pin-toggle' + (task && task.progressEnabled ? ' on' : '') + '" aria-pressed="' +
      (task && task.progressEnabled ? 'true' : 'false') + '"><span class="pin-knob"></span></button></div>' +
      '<div class="field" data-host="pprog"' + (task && task.progressEnabled ? '' : ' hidden') + '>' +
      '<label>' + u.esc(t('t.progress')) + '</label>' +
      '<div class="task-progress"><input type="range" min="0" max="100" step="1" value="' +
      (task ? (task.progress || 0) : 0) + '" dir="ltr" data-pprog aria-label="' + u.esc(t('t.progress')) + '">' +
      '<span class="tp-val num" data-pval>' + (task ? (task.progress || 0) : 0) + '%</span></div></div>' +
      '<div class="field"><label>' + u.esc(t('t.subject')) + '</label><div data-host="subj"></div></div>';

    var diff = segmentedDiff(task ? task.difficulty : 'light');
    body.querySelector('[data-host="diff"]').appendChild(diff);

    /* progress toggle + colored slider (red → blue → green) */
    var penToggle = body.querySelector('#tf-pen');
    var pprogHost = body.querySelector('[data-host="pprog"]');
    var pprogInput = pprogHost.querySelector('[data-pprog]');
    var pprogVal = pprogHost.querySelector('[data-pval]');
    var penOn = !!(task && task.progressEnabled);

    function progColor(p) {
      return p <= 50
        ? u.mix('#e5484d', '#3a6edc', p / 50)
        : u.mix('#3a6edc', '#46a758', (p - 50) / 50);
    }
    function paintProgress() {
      var p = parseInt(pprogInput.value, 10) || 0;
      var fill = progColor(p);
      pprogInput.style.background =
        'linear-gradient(to right, ' + fill + ' 0 ' + p + '%, var(--surface-2) ' + p + '% 100%)';
      pprogVal.textContent = p + '%';
    }
    penToggle.addEventListener('click', function () {
      penOn = !penOn;
      penToggle.classList.toggle('on', penOn);
      penToggle.setAttribute('aria-pressed', penOn ? 'true' : 'false');
      pprogHost.hidden = !penOn;
      if (penOn) paintProgress();
    });
    pprogInput.addEventListener('input', paintProgress);
    if (penOn) paintProgress();
    var openDateToggle = body.querySelector('#tf-open-date');
    var dateInput = body.querySelector('#tf-date');
    var openDateOn = !date;
    openDateToggle.addEventListener('click', function () {
      openDateOn = !openDateOn;
      openDateToggle.classList.toggle('on', openDateOn);
      openDateToggle.setAttribute('aria-pressed', openDateOn ? 'true' : 'false');
      dateInput.disabled = openDateOn;
      dateInput.style.opacity = openDateOn ? '0.5' : '1';
    });

    var subj = subjectChips(task ? task.subjectId : null);
    body.querySelector('[data-host="subj"]').appendChild(subj);

    var foot =
      (editing ? '<button class="btn btn-danger" data-x="del"></button>' : '') +
      '<button class="btn btn-primary" data-x="save"></button>';

    var h = openSheet({
      title: editing ? t('t.edit') : t('t.add'),
      body: body,
      footHTML: foot,
    });

    var saveBtn = h.el.querySelector('[data-x="save"]');
    var delBtn = h.el.querySelector('[data-x="del"]');
    saveBtn.textContent = t('a.save');
    if (delBtn) delBtn.textContent = t('a.delete');

    // empty-subjects hint
    if (subj.isEmpty()) {
      var hint = document.createElement('p');
      hint.className = 'hint-line';
      hint.style.marginTop = '-6px';
      hint.textContent = t('t.needSubjects');
      subj.after(hint);
    }

    var input = body.querySelector('#tf-title');
    var err = body.querySelector('.field-error');
    input.addEventListener('input', function () {
      err.hidden = true;
      input.removeAttribute('aria-invalid');
    });

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }

    saveBtn.addEventListener('click', function () {
      var title = input.value.trim();
      if (!title) {
        err.textContent = t('t.taskTitle');
        err.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      var d = openDateOn ? "" : body.querySelector('#tf-date').value;
      if (!openDateOn && !u.isValidYMD(d)) {
        fail(t('t.date'));
        return;
      }
      var data = {
        title: title,
        description: body.querySelector('#tf-desc').value.trim(),
        date: d,
        difficulty: diff.getSelected(),
        subjectId: subj.getSelected(),
        progressEnabled: penOn,
        progress: penOn ? parseInt(pprogInput.value, 10) || 0 : (task ? task.progress : 0),
      };
      if (data.progressEnabled && data.progress >= 100) data.done = true;
      if (editing) SL.store.updateTask(task.id, data);
      else SL.store.addTask(data);
      h.close();
      toast(t('toast.saved'));
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') saveBtn.click();
    });

    if (delBtn) {
      delBtn.addEventListener('click', function () {
        confirmSheet({ title: t('t.deleteQ'), danger: true }).then(function (yes) {
          if (yes) {
            SL.store.deleteTask(task.id);
            h.close();
            toast(t('toast.deleted'));
          }
        });
      });
    }
  }

  /* ---------- Note form ---------- */

  function openNoteForm(opts) {
    opts = opts || {};
    var note = opts.note || null;
    var editing = !!note;
    var images = note ? note.images.slice() : [];
    var pinned = note ? !!note.pinned : false;

    var body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><label for="nf-title">' + u.esc(t('n.noteTitle')) + '</label>' +
      '<input class="input" id="nf-title" maxlength="120" value="' + u.esc(note ? note.title : '') +
      '" placeholder="' + u.esc(t('n.titlePh')) + '"></div>' +
      '<div class="field"><label for="nf-text">' + u.esc(t('n.text')) + '</label>' +
      '<textarea class="textarea" id="nf-text" placeholder="' + u.esc(t('n.textPh')) + '">' +
      u.esc(note ? note.text : '') +
      '</textarea></div>' +
      '<div class="field"><label>' + u.esc(t('n.subject')) + '</label><div data-host="subj"></div></div>' +
      '<div class="field" style="flex-direction:row;align-items:center;justify-content:space-between">' +
      '<label for="nf-pin" style="margin:0">' + u.esc(t('n.pin')) + '</label>' +
      '<button type="button" id="nf-pin" class="pin-toggle' + (note && note.pinned ? ' on' : '') + '" aria-pressed="' +
      (note && note.pinned ? 'true' : 'false') + '"><span class="pin-knob"></span></button></div>' +
      '<div class="field"><label>' + u.esc(t('n.images')) + '</label>' +
      '<div class="img-grid" data-host="imgs"></div></div>';

    var subj = subjectChips(note ? note.subjectId : null);
    body.querySelector('[data-host="subj"]').appendChild(subj);

    var imgsHost = body.querySelector('[data-host="imgs"]');
    var origImages = note ? note.images.slice() : [];
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    fileInput.hidden = true;
    body.appendChild(fileInput);

    function renderImgs() {
      imgsHost.innerHTML = '';
      images.forEach(function (entry, i) {
        var th = document.createElement('div');
        th.className = 'img-thumb';
        if (isDataUrl(entry)) {
          var img = document.createElement('img');
          img.src = entry;
          img.alt = '';
          th.appendChild(img);
        } else {
          var ph = document.createElement('span');
          ph.className = 'img-ph';
          ph.setAttribute('data-img-id', entry);
          th.appendChild(ph);
        }
        var rm = document.createElement('button');
        rm.className = 'rm';
        rm.type = 'button';
        rm.setAttribute('aria-label', t('a.delete'));
        rm.innerHTML = icon('x', 14);
        rm.addEventListener('click', function () {
          images.splice(i, 1);
          renderImgs();
        });
        th.appendChild(rm);
        imgsHost.appendChild(th);
      });
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'img-add';
      add.innerHTML = icon('image', 20) + '<span>' + u.esc(t('n.addImage')) + '</span>';
      add.addEventListener('click', function () {
        fileInput.click();
      });
      imgsHost.appendChild(add);
      hydrateImages(imgsHost);
    }

    var pinToggle = body.querySelector('#nf-pin');
    pinToggle.addEventListener('click', function () {
      pinned = !pinned;
      pinToggle.classList.toggle('on', pinned);
      pinToggle.setAttribute('aria-pressed', pinned ? 'true' : 'false');
    });

    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      files.forEach(function (f) {
        u
          .compressImage(f)
          .then(function (dataUrl) {
            if (SL.db.available) {
              var id = u.uid();
              return SL.db.putImage(id, u.dataURLtoBlob(dataUrl)).then(function () {
                images.push(id);
                renderImgs();
              });
            }
            images.push(dataUrl);
            renderImgs();
          })
          .catch(function () {
            toast(t('n.imgFailed'), 'error');
          });
      });
      fileInput.value = '';
    });

    renderImgs();

    var foot =
      (editing ? '<button class="btn btn-danger" data-x="del"></button>' : '') +
      '<button class="btn btn-primary" data-x="save"></button>';

    var h = openSheet({
      title: editing ? t('n.edit') : t('n.new'),
      body: body,
      footHTML: foot,
    });

    h.el.querySelector('[data-x="save"]').textContent = t('a.save');
    var delBtn = h.el.querySelector('[data-x="del"]');
    if (delBtn) delBtn.textContent = t('a.delete');

    h.el.querySelector('[data-x="save"]').addEventListener('click', function () {
      var data = {
        title: body.querySelector('#nf-title').value,
        text: body.querySelector('#nf-text').value,
        subjectId: subj.getSelected(),
        images: images,
        pinned: pinned,
      };
      if (editing) SL.store.updateNote(note.id, data);
      else SL.store.addNote(data);
      // drop blobs removed during this editing session
      origImages.forEach(function (id) {
        if (!isDataUrl(id) && images.indexOf(id) === -1) {
          SL.db.deleteImage(id).catch(function () {});
        }
      });
      h.close();
      toast(t('toast.saved'));
    });

    if (delBtn) {
      delBtn.addEventListener('click', function () {
        confirmSheet({ title: t('n.deleteQ'), danger: true }).then(function (yes) {
          if (yes) {
            SL.store.deleteNote(note.id);
            h.close();
            toast(t('toast.deleted'));
          }
        });
      });
    }
  }

  SL.ui = {
    icon: icon,
    toast: toast,
    openSheet: openSheet,
    closeTopSheet: closeTopSheet,
    confirmSheet: confirmSheet,
    pickColor: pickColor,
    openSubjectManager: openSubjectManager,
    openTaskForm: openTaskForm,
    openNoteForm: openNoteForm,
    hydrateImages: hydrateImages,
    hasOpenSheet: function () {
      return openSheets.length > 0;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

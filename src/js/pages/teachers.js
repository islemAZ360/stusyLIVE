/* ============================================================
   Study Live — pages/teachers.js
   Teachers + public ratings: cards with photo, subject, star
   average; add/edit sheet with photo upload; rate sheet with
   interactive 1–5 stars + comment + the ratings history.
   Flat JSON in the store — maps 1:1 onto a Supabase
   `teachers` / `teacher_ratings` schema when Google sign-in lands.
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var u = SL.utils;

  function t(key, vars) {
    return SL.i18n.t(key, vars);
  }

  var AVATAR_COLORS = ['#33589e', '#7b5aa6', '#2f9e8f', '#b3541e', '#c0392b', '#b8860b', '#2f6f4f', '#8a4baf'];

  function avatarColor(name) {
    var s = String(name || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function initial(name) {
    var s = String(name || '').trim();
    return s ? s.charAt(0).toUpperCase() : '?';
  }

  function isDataUrl(x) {
    return (
      typeof x === 'string' &&
      /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(x)
    );
  }

  function photoHTML(photo, name) {
    if (!photo) {
      return (
        '<span class="av-initial" style="background:' + avatarColor(name) + '">' +
        u.esc(initial(name)) + '</span>'
      );
    }
    if (isDataUrl(photo)) {
      return '<img class="av-img" src="' + u.esc(photo) + '" alt="" decoding="async" loading="lazy">';
    }
    return (
      '<span class="av-img-ph" data-img-id="' + u.esc(photo) + '" style="background:' +
      avatarColor(name) + '">' + u.esc(initial(name)) + '</span>'
    );
  }

  function starsHTML(avg) {
    var rounded = Math.round(avg);
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<span class="star' + (i <= rounded ? ' on' : '') + '">' + SL.ui.icon('star', 14) + '</span>';
    }
    return out;
  }

  function subjectChip(te) {
    var linked = SL.store.subjectsOfTeacher(te.id);
    var subj = linked[0] || (te.subjectId ? SL.store.subjectById(te.subjectId) : null);
    if (subj) {
      return (
        '<span class="dot" style="background:' + u.esc(subj.color) + '"></span>' +
        u.esc(subj.name)
      );
    }
    if (te.subjectName) {
      return (
        '<span class="dot" style="background:var(--none-subject)"></span>' +
        u.esc(te.subjectName)
      );
    }
    return (
      '<span class="dot" style="background:var(--none-subject)"></span>' +
      u.esc(t('th.noSubject'))
    );
  }

  function allSubjects() {
    var out = [];
    SL.store.get().academic.years.forEach(function (y) {
      y.semesters.forEach(function (sem) {
        SL.store.subjectsOf(sem.id).forEach(function (s) {
          out.push(s);
        });
      });
    });
    return out;
  }

  function cardHTML(te) {
    var r = SL.store.teacherRating(te);
    return (
      '<div class="teacher-card stagger" data-id="' + u.esc(te.id) + '">' +
      '<div class="tc-photo">' + photoHTML(te.photo, te.name) + '</div>' +
      '<div class="tc-body">' +
      '<div class="tc-name">' + u.esc(te.name) + '</div>' +
      '<div class="tc-subj">' + subjectChip(te) + '</div>' +
      '<div class="tc-rate">' +
      starsHTML(r.avg) +
      '<span class="tc-avg">' + (r.avg ? r.avg.toFixed(1) : '—') + '</span>' +
      '<span class="tc-count">(' + r.count + ')</span>' +
      '</div>' +
      '</div>' +
      '<div class="tc-actions">' +
      '<button class="mini-btn tc-rate-btn" data-act="rate" aria-label="' + u.esc(t('th.rate')) + '">' +
      SL.ui.icon('star', 18) + '</button>' +
      '<button class="mini-btn" data-act="edit" aria-label="' + u.esc(t('a.edit')) + '">' +
      SL.ui.icon('pencil', 17) + '</button>' +
      '<button class="mini-btn danger" data-act="del" aria-label="' + u.esc(t('a.delete')) + '">' +
      SL.ui.icon('trash', 17) + '</button>' +
      '</div>' +
      '</div>'
    );
  }

  /* ---------- add / edit sheet ---------- */

  function openTeacherForm(existing) {
    var editing = !!existing;
    var photo = existing ? (existing.photo || null) : null;
    var selectedSubj = existing ? existing.subjectId : '';

    var body = document.createElement('div');
    body.className = 'tf-form';

    var photoHtml =
      '<div class="tf-photo-row">' +
      '<div class="tf-preview" data-host="preview">' + photoHTML(photo, existing ? existing.name : '') + '</div>' +
      '<div class="tf-photo-btns">' +
      '<button type="button" class="btn btn-ghost" data-act="pick">' + SL.ui.icon('image', 16) +
      '<span>' + u.esc(t('th.addPhoto')) + '</span></button>' +
      '<button type="button" class="btn btn-ghost danger" data-act="remove" hidden>' +
      SL.ui.icon('trash', 16) + '<span>' + u.esc(t('th.removePhoto')) + '</span></button>' +
      '</div>' +
      '<input type="file" accept="image/*" data-host="file" hidden>' +
      '</div>';

    body.innerHTML =
      '<div class="field"><label>' + u.esc(t('th.name')) + '</label>' +
      '<input class="input" data-host="name" placeholder="' + u.esc(t('th.namePh')) +
      '" value="' + u.esc(existing ? existing.name : '') + '"></div>' +
      '<div class="field"><label>' + u.esc(t('th.subject')) + '</label>' +
      '<select class="select" data-host="subject">' +
      '<option value="">' + u.esc(t('th.noSubject')) + '</option>' +
      allSubjects()
        .map(function (s) {
          return (
            '<option value="' + u.esc(s.id) + '"' + (s.id === selectedSubj ? ' selected' : '') + '>' +
            u.esc(s.name) + '</option>'
          );
        })
        .join('') +
      '</select></div>' +
      '<div class="field"><label>' + u.esc(t('th.photo')) + '</label>' + photoHtml + '</div>';

    var foot =
      (editing ? '<button class="btn btn-danger" data-x="del"></button>' : '') +
      '<button class="btn btn-primary" data-x="save"></button>';

    var h = SL.ui.openSheet({ title: editing ? t('th.edit') : t('th.add'), body: body, footHTML: foot });
    h.el.querySelector('[data-x="save"]').textContent = t('a.save');
    var delBtn = h.el.querySelector('[data-x="del"]');
    if (delBtn) delBtn.textContent = t('a.delete');

    function renderPhoto() {
      var host = h.el.querySelector('[data-host="preview"]');
      host.innerHTML = photoHTML(photo, h.el.querySelector('[data-host="name"]').value || (existing ? existing.name : ''));
      var removeBtn = h.el.querySelector('[data-act="remove"]');
      removeBtn.hidden = !photo;
      SL.ui.hydrateImages(host);
    }

    var fileInput = body.querySelector('[data-host="file"]');
    h.el.querySelector('[data-act="pick"]').addEventListener('click', function () {
      fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      u.compressImage(f).then(function (dataUrl) {
        if (SL.db.available) {
          var id = u.uid();
          return SL.db.putImage(id, u.dataURLtoBlob(dataUrl)).then(function () {
            photo = id;
          });
        }
        photo = dataUrl;
      }).then(function () {
        renderPhoto();
      }).catch(function () {
        SL.ui.toast(t('n.imgFailed'), 'error');
      });
      fileInput.value = '';
    });

    h.el.querySelector('[data-act="remove"]').addEventListener('click', function () {
      photo = null;
      renderPhoto();
    });

    h.el.querySelector('[data-x="save"]').addEventListener('click', function () {
      var nameEl = h.el.querySelector('[data-host="name"]');
      var name = (nameEl.value || '').trim();
      if (!name) {
        nameEl.focus();
        return;
      }
      var subjEl = h.el.querySelector('[data-host="subject"]');
      var subjectId = subjEl.value || null;
      var subjectName = subjectId ? ((SL.store.subjectById(subjectId) || {}).name || '') : '';
      var data = { name: name, subjectId: subjectId, subjectName: subjectName, photo: photo };
      if (editing) SL.store.updateTeacher(existing.id, data);
      else SL.store.addTeacher(data);
      SL.ui.toast(t('toast.saved'));
      h.close();
    });

    if (delBtn) {
      delBtn.addEventListener('click', function () {
        SL.ui.confirmSheet({
          title: t('th.confirmDel', { name: existing.name }),
          message: t('th.confirmDelHint'),
          danger: true,
        }).then(function (yes) {
          if (!yes) return;
          SL.store.deleteTeacher(existing.id);
          SL.ui.toast(t('toast.deleted'));
          h.close();
        });
      });
    }

    renderPhoto();
  }

  /* ---------- rate sheet ---------- */

  function openRateSheet(te) {
    var picked = 0;

    var body = document.createElement('div');
    body.className = 'rf-form';

    body.innerHTML =
      '<div class="field"><label>' + u.esc(t('th.rateTitle')) + '</label>' +
      '<div class="rf-stars" data-host="stars"></div>' +
      '<p class="rf-hint">' + u.esc(t('th.ratePh')) + '</p></div>' +
      '<div class="field"><label>' + u.esc(t('th.comment')) + '</label>' +
      '<textarea class="textarea" data-host="comment" rows="3" placeholder="' +
      u.esc(t('th.commentPh')) + '"></textarea></div>' +
      '<div class="rf-list-head">' + u.esc(t('th.ratings')) + '</div>' +
      '<div class="rf-list" data-host="list"></div>';

    var h = SL.ui.openSheet({
      title: te.name,
      body: body,
      footHTML: '<button class="btn btn-primary" data-x="save"></button>',
    });
    h.el.querySelector('[data-x="save"]').textContent = t('th.rate');

    var starHost = h.el.querySelector('[data-host="stars"]');
    var starBtns = [];
    for (var s = 1; s <= 5; s++) {
      (function (val) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'rf-star';
        b.setAttribute('data-v', val);
        b.setAttribute('aria-label', val + ' / 5');
        b.innerHTML = SL.ui.icon('star', 26);
        b.addEventListener('click', function () {
          picked = val;
          paint();
        });
        starBtns.push(b);
        starHost.appendChild(b);
      })(s);
    }

    function paint() {
      starBtns.forEach(function (b) {
        var on = Number(b.getAttribute('data-v')) <= picked;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function ratingRowHTML(r) {
      var rs = '';
      for (var i = 1; i <= 5; i++) {
        rs += '<span class="star' + (i <= r.stars ? ' on' : '') + '">' + SL.ui.icon('star', 12) + '</span>';
      }
      return (
        '<div class="rf-row" data-id="' + u.esc(r.id) + '">' +
        '<div class="rf-row-top">' +
        '<span class="rf-stars-mini">' + rs + '</span>' +
        '<span class="rf-date">' + u.esc(u.fmtDateShort(u.ymd(new Date(r.at)), SL.i18n.lang)) + '</span>' +
        '<button class="mini-btn danger" data-del aria-label="' + u.esc(t('a.delete')) + '">' +
        SL.ui.icon('trash', 14) + '</button>' +
        '</div>' +
        (r.comment ? '<div class="rf-comment">' + u.esc(r.comment) + '</div>' : '') +
        '</div>'
      );
    }

    function renderRatings() {
      var list = h.el.querySelector('[data-host="list"]');
      if (!te.ratings || !te.ratings.length) {
        list.innerHTML = '<div class="rf-empty">' + u.esc(t('th.noRatings')) + '</div>';
        return;
      }
      var sorted = te.ratings.slice().sort(function (a, b) {
        return (b.at || 0) - (a.at || 0);
      });
      list.innerHTML = sorted.map(ratingRowHTML).join('');
    }

    h.el.querySelector('[data-host="list"]').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (!del) return;
      var row = e.target.closest('.rf-row');
      if (!row) return;
      SL.store.deleteRating(te.id, row.getAttribute('data-id'));
      renderRatings();
    });

    h.el.querySelector('[data-x="save"]').addEventListener('click', function () {
      if (!picked) {
        starBtns[0].focus();
        return;
      }
      var comment = h.el.querySelector('[data-host="comment"]').value;
      SL.store.rateTeacher(te.id, picked, comment);
      SL.ui.toast(t('toast.saved'));
      h.close();
    });

    paint();
    renderRatings();
  }

  /* ---------- delete ---------- */

  function confirmDelete(te) {
    SL.ui.confirmSheet({
      title: t('th.confirmDel', { name: te.name }),
      message: t('th.confirmDelHint'),
      danger: true,
    }).then(function (yes) {
      if (yes) {
        SL.store.deleteTeacher(te.id);
        SL.ui.toast(t('toast.deleted'));
      }
    });
  }

  /* ---------- render ---------- */

  function render(rootEl) {
    var all = SL.store.teachers();
    var emptyHtml = '';
    if (!all.length) {
      emptyHtml =
        '<div class="empty">' +
        SL.ui.icon('graduation', 40) +
        '<div class="e-title">' + u.esc(t('th.empty')) + '</div>' +
        '<div class="e-hint">' + u.esc(t('th.emptyHint')) + '</div></div>';
    }

    rootEl.innerHTML =
      '<header class="page-head">' +
      '<h1><div class="icon-wrap">' + SL.ui.icon('graduation', 24) + '</div><span>' +
      u.esc(t('nav.teachers')) + '</span></h1></header>' +
      '<div class="page-content">' +
      emptyHtml +
      '<div class="teachers-grid">' +
      all.map(cardHTML).join('') +
      '</div></div>';

    SL.ui.hydrateImages(rootEl);

    var grid = rootEl.querySelector('.teachers-grid');
    if (!grid) return;
    grid.addEventListener('click', function (e) {
      var card = e.target.closest('.teacher-card');
      if (!card) return;
      var te = SL.store.teacherById(card.getAttribute('data-id'));
      if (!te) return;
      var act = e.target.closest('[data-act]');
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'rate') openRateSheet(te);
        else if (a === 'edit') openTeacherForm(te);
        else if (a === 'del') confirmDelete(te);
        e.stopPropagation();
      } else {
        openRateSheet(te);
      }
    });
  }

  SL.pages = SL.pages || {};
  SL.pages.teachers = {
    id: 'teachers',
    labelKey: 'nav.teachers',
    icon: 'graduation',
    getFab: function () {
      return { labelKey: 'th.add', action: function () { openTeacherForm(null); } };
    },
    render: render,
  };
})(typeof window !== 'undefined' ? window : globalThis);
/* ============================================================
   Study Live — pages/profile.js
   Student details, academic structure (years × semesters),
   current position, subjects per semester, new-semester flow,
   backup export/import, reset.
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var u = SL.utils;
  var t = function (k, v) {
    return SL.i18n.t(k, v);
  };

  function icon(name, size) {
    return SL.ui.icon(name, size);
  }

  function semTitle(yearIndex, semIndex) {
    return SL.i18n.semName(semIndex + 1) + ' — ' + SL.i18n.yearName(yearIndex + 1);
  }

  /* ---------- setup card (no structure yet) ---------- */

  function setupCard(root2) {
    var el = document.createElement('div');
    el.className = 'card setup-card';
    el.innerHTML =
      '<div class="e-title" style="font-weight:600;font-size:15px;margin-bottom:4px">' + u.esc(t('p.setup')) + '</div>' +
      '<p class="hint">' + u.esc(t('p.setupHint')) + '</p>' +
      '<div class="setup-row"><span class="lbl">' + u.esc(t('p.years')) + '</span>' +
      '<span class="stepper"><button type="button" data-act="y-">−</button><span class="val" data-host="yv">4</span>' +
      '<button type="button" data-act="y+">+</button></span></div>' +
      '<div class="setup-row"><span class="lbl">' + u.esc(t('p.semsPerYear')) + '</span>' +
      '<span class="stepper"><button type="button" data-act="s-">−</button><span class="val" data-host="sv">2</span>' +
      '<button type="button" data-act="s+">+</button></span></div>' +
      '<button class="btn btn-primary btn-block" data-act="create" style="margin-top:12px">' +
      icon('check', 17) + u.esc(t('a.create')) + '</button>';

    var years = 4;
    var sems = 2;
    el.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.getAttribute('data-act');
      if (a === 'y+') years = Math.min(8, years + 1);
      if (a === 'y-') years = Math.max(1, years - 1);
      if (a === 's+') sems = Math.min(4, sems + 1);
      if (a === 's-') sems = Math.max(1, sems - 1);
      el.querySelector('[data-host="yv"]').textContent = years;
      el.querySelector('[data-host="sv"]').textContent = sems;
      if (a === 'create') {
        SL.store.createStructure(years, sems);
        SL.ui.toast(t('toast.saved'));
        render(root2);
      }
    });
    return el;
  }

  /* ---------- structure editor sheet ---------- */

  function openStructureEditor(root2) {
    var st = SL.store.get();
    var years = st.academic.years;

    var body = document.createElement('div');
    function renderBody() {
      body.innerHTML =
        '<p class="hint-line" style="margin-bottom:12px">' + u.esc(t('p.setupHint')) + '</p>' +
        years
          .map(function (y, yi) {
            return (
              '<div class="card year-block" data-yid="' + y.id + '">' +
              '<div class="year-head">' + u.esc(SL.i18n.yearName(yi + 1)) +
              '<span class="y-actions">' +
              '<button class="mini-btn danger" data-act="dely" aria-label="' + u.esc(t('a.delete')) + '">' + icon('trash', 17) + '</button>' +
              '</span></div>' +
              y.semesters
                .map(function (s, si) {
                  return (
                    '<div class="sem-row"><span class="s-title">' + u.esc(SL.i18n.semName(si + 1)) + '</span>' +
                    '<span class="s-actions"><span class="stepper">' +
                    '<button data-act="dels" data-sid="' + s.id + '" aria-label="' + u.esc(t('a.delete')) + '">−</button>' +
                    '<span class="val">' + (si + 1) + '</span>' +
                    '<button data-act="nose" aria-hidden="true" tabindex="-1" style="visibility:hidden">+</button>' +
                    '</span></span></div>'
                  );
                })
                .join('') +
              '<button class="btn btn-ghost" data-act="addsem" style="min-height:38px;font-size:13px;width:100%;margin-top:8px">' +
              icon('plus', 15) + u.esc(t('p.pickSem')) + '</button>' +
              '</div>'
            );
          })
          .join('') +
        '<button class="btn btn-ghost btn-block" data-act="addy" style="margin-top:10px">' +
        icon('plus', 17) + u.esc(t('p.addYear')) + '</button>';
    }
    renderBody();

    var h = SL.ui.openSheet({ title: t('p.editStructure'), body: body, autofocus: false });

    body.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.getAttribute('data-act');
      var block = e.target.closest('[data-yid]');
      var yid = block ? block.getAttribute('data-yid') : null;
      if (a === 'addy') {
        SL.store.addYear();
        years = SL.store.get().academic.years;
        renderBody();
      } else if (a === 'addsem' && yid) {
        SL.store.addSemester(yid);
        renderBody();
      } else if (a === 'dely' && yid) {
        SL.ui.confirmSheet({ title: t('p.delYearQ'), message: t('p.delYearHint'), danger: true }).then(function (yes) {
          if (yes) {
            SL.store.removeYear(yid);
            years = SL.store.get().academic.years;
            renderBody();
            if (!years.length) {
              h.close();
              render(root2);
            }
          }
        });
      } else if (a === 'dels') {
        var sid = act.getAttribute('data-sid');
        SL.ui.confirmSheet({ title: t('p.delSemQ'), message: t('p.delSemHint'), danger: true }).then(function (yes) {
          if (yes) {
            SL.store.removeSemester(sid);
            renderBody();
          }
        });
      }
    });

    h.el.querySelector('.sheet-head [data-close]').addEventListener('click', function () {
      render(root2);
    });
  }

  /* ---------- semester picker sheet (new semester flow) ---------- */

  function openSemesterPicker(root2) {
    var st = SL.store.get();
    var years = st.academic.years;
    var body = document.createElement('div');

    body.innerHTML =
      '<p class="hint-line" style="margin-bottom:10px">' + u.esc(t('p.pickHint')) + '</p>' +
      years
        .map(function (y, yi) {
          return (
            '<div style="margin-bottom:10px"><div class="section-title" style="margin:8px 2px 4px">' +
            u.esc(SL.i18n.yearName(yi + 1)) + '</div>' +
            y.semesters
              .map(function (s, si) {
                var cnt = SL.store.subjectsOf(s.id).length;
                return (
                  '<button type="button" class="semester-pick-row" data-sid="' + s.id + '">' +
                  '<span class="sp-meta"><span class="sp-title">' + u.esc(SL.i18n.semName(si + 1)) + '</span>' +
                  '<span class="sp-sub">' + u.esc(t('p.subjectsCount', { n: cnt })) + '</span></span>' +
                  '<span class="status-chip status-' + s.status + '">' + u.esc(t('st.' + s.status)) + '</span>' +
                  '</button>'
                );
              })
              .join('') +
            '</div>'
          );
        })
        .join('');

    var h = SL.ui.openSheet({ title: t('p.pickSemester'), body: body, autofocus: false });

    body.addEventListener('click', function (e) {
      var row = e.target.closest('[data-sid]');
      if (!row) return;
      var sid = row.getAttribute('data-sid');
      h.close();
      openSemesterActions(sid, root2);
    });
  }

  /* ---------- actions for a chosen semester ---------- */

  function openSemesterActions(sid, root2) {
    var found = SL.store._findSem(sid);
    if (!found) return;
    var sem = found.sem;

    var body = document.createElement('div');
    function statusChip() {
      return '<span class="status-chip status-' + sem.status + '">' + u.esc(t('st.' + sem.status)) + '</span>';
    }
    function renderBody() {
      body.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">' +
        '<strong style="font-size:15px">' + u.esc(semTitle(found.yearIndex, found.semIndex)) + '</strong>' +
        statusChip() + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px">' +
        (sem.status !== 'current'
          ? '<button class="btn btn-primary btn-block" data-act="cur">' + icon('bookmark', 17) + u.esc(t('p.markCurrent')) + '</button>'
          : '') +
        (sem.status !== 'done'
          ? '<button class="btn btn-ghost btn-block" data-act="done">' + icon('check', 17) + u.esc(t('p.markDone')) + '</button>'
          : '') +
        (sem.status !== 'future'
          ? '<button class="btn btn-ghost btn-block" data-act="fut">' + icon('clock', 17) + u.esc(t('p.markFuture')) + '</button>'
          : '') +
        '<button class="btn btn-ghost btn-block" data-act="subs">' + icon('tag', 17) +
        u.esc(t('p.manageFor', { sem: SL.i18n.semName(found.semIndex + 1) })) + '</button>' +
        '</div>';
    }
    renderBody();

    var h = SL.ui.openSheet({ title: t('p.pickSemester'), body: body, autofocus: false });

    body.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.getAttribute('data-act');
      if (a === 'cur') {
        SL.store.setSemesterStatus(sid, 'current');
        sem = SL.store._findSem(sid).sem;
        renderBody();
        render(root2);
        SL.ui.toast(t('toast.saved'));
      } else if (a === 'done') {
        SL.store.setSemesterStatus(sid, 'done');
        sem = SL.store._findSem(sid).sem;
        renderBody();
        render(root2);
      } else if (a === 'fut') {
        SL.store.setSemesterStatus(sid, 'future');
        sem = SL.store._findSem(sid).sem;
        renderBody();
        render(root2);
      } else if (a === 'subs') {
        h.close();
        setTimeout(function () {
          SL.ui.openSubjectManager(sid);
        }, 200);
      }
    });
  }

  /* ---------- main render ---------- */

  function render(root2) {
    var st = SL.store.get();
    var p = st.profile;
    var cur = SL.store.currentSemester();
    var hasStruct = SL.store.hasStructure();

    root2.innerHTML =
      '<h1 class="page-title">' + u.esc(t('p.title')) + '</h1>' +

      '<div class="card profile-head">' +
      '<span class="avatar">' + icon('profile', 26) + '</span>' +
      '<span style="min-width:0"><span class="p-name">' + u.esc(p.degree || t('p.title')) + '</span>' +
      '<span class="p-sub">' + u.esc([p.specialty, p.group].filter(Boolean).join(' · ') || '—') + '</span></span>' +
      '</div>' +

      '<h2 class="section-title">' + u.esc(t('p.student')) + '</h2>' +
      '<div class="card card-pad" data-host="student"></div>' +

      '<h2 class="section-title">' + icon('bookmark', 14) + u.esc(t('p.position')) + '</h2>';

    if (!hasStruct) {
      root2.appendChild(setupCard(root2));
    } else {
      var pos = document.createElement('div');
      pos.className = 'card position-card';
      var nowHTML = cur
        ? t('p.now', {
            year: SL.i18n.yearName(cur.yearIndex + 1),
            sem: SL.i18n.semName(cur.semIndex + 1),
          })
        : t(hasStruct ? 's.noCurrent' : 'p.noStructure');
      pos.innerHTML =
        '<div class="pos-now">' +
        '<span class="pos-badge">' + icon('bookmark', 16) + '<span>' + u.esc(nowHTML) + '</span></span>' +
        '<button class="btn btn-ghost" data-act="picksem" style="min-height:40px;font-size:13.5px">' + u.esc(t('p.newSem')) + '</button>' +
        '</div>';
      root2.appendChild(pos);
    }

    // structure
    if (hasStruct) {
      var structTitle = document.createElement('h2');
      structTitle.className = 'section-title';
      structTitle.innerHTML = icon('tasks', 14) + u.esc(t('p.structure'));
      var editBtn = document.createElement('button');
      editBtn.className = 'mini-btn';
      editBtn.style.marginInlineStart = 'auto';
      editBtn.setAttribute('aria-label', t('p.editStructure'));
      editBtn.innerHTML = icon('pencil', 15);
      editBtn.addEventListener('click', function () {
        openStructureEditor(root2);
      });
      structTitle.appendChild(editBtn);
      root2.appendChild(structTitle);

      var structCard = document.createElement('div');
      structCard.className = 'card card-pad';
      structCard.innerHTML = st.academic.years
        .map(function (y, yi) {
          return (
            '<div class="year-block" style="border:none;padding:2px 0">' +
            '<div class="year-head">' + u.esc(SL.i18n.yearName(yi + 1)) + '</div>' +
            y.semesters
              .map(function (s, si) {
                var cnt = SL.store.subjectsOf(s.id).length;
                return (
                  '<div class="sem-row">' +
                  '<span class="s-title">' + u.esc(SL.i18n.semName(si + 1)) + '</span>' +
                  '<span class="s-count">' + u.esc(t('p.subjectsCount', { n: cnt })) + '</span>' +
                  '<span class="s-actions">' +
                  '<button class="mini-btn" data-sid="' + s.id + '" data-act="managesem" style="min-width:36px;min-height:36px" aria-label="' +
                  u.esc(t('a.edit')) + '">' + icon('pencil', 15) + '</button>' +
                  '<span class="status-chip status-' + s.status + '">' + u.esc(t('st.' + s.status)) + '</span>' +
                  '</span></div>'
                );
              })
              .join('') +
            '</div>'
          );
        })
        .join('');
      root2.appendChild(structCard);
    }

    // subjects shortcut
    if (hasStruct && cur) {
      var subsTitle = document.createElement('h2');
      subsTitle.className = 'section-title';
      subsTitle.innerHTML = icon('tag', 14) + u.esc(t('p.subjects'));
      root2.appendChild(subsTitle);

      var subsCard = document.createElement('div');
      subsCard.className = 'card card-pad';
      subsCard.innerHTML =
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-ghost" data-act="mngcur" style="flex:1">' + icon('tag', 17) +
        u.esc(t('p.manageFor', { sem: SL.i18n.semName(cur.semIndex + 1) })) + '</button>' +
        '<button class="btn btn-ghost" data-act="picksem" style="flex:1">' + icon('chevR', 16) +
        u.esc(t('p.pickSemester')) + '</button>' +
        '</div>';
      root2.appendChild(subsCard);
    }

    // preferences
    var prefsTitle = document.createElement('h2');
    prefsTitle.className = 'section-title';
    prefsTitle.innerHTML = icon('globe', 14) + u.esc(t('p.prefs'));
    root2.appendChild(prefsTitle);

    var prefsCard = document.createElement('div');
    prefsCard.className = 'card card-pad';
    prefsCard.innerHTML =
      '<div class="field" style="margin-bottom:0"><label for="pf-ws">' + u.esc(t('p.weekStart')) + '</label>' +
      '<select class="select" id="pf-ws">' +
      '<option value="1">' + u.esc(t('ws.mon')) + '</option>' +
      '<option value="6">' + u.esc(t('ws.sat')) + '</option>' +
      '<option value="0">' + u.esc(t('ws.sun')) + '</option>' +
      '</select></div>';
    root2.appendChild(prefsCard);

    var wsSelect = prefsCard.querySelector('#pf-ws');
    wsSelect.value = String(st.settings.weekStart == null ? 1 : st.settings.weekStart);
    wsSelect.addEventListener('change', function () {
      SL.store.setWeekStart(parseInt(wsSelect.value, 10));
      render(root2);
    });

    // data
    var dataTitle = document.createElement('h2');
    dataTitle.className = 'section-title';
    dataTitle.innerHTML = icon('download', 14) + u.esc(t('p.data'));
    root2.appendChild(dataTitle);

    var dataCard = document.createElement('div');
    dataCard.className = 'card card-pad data-actions';
    dataCard.innerHTML =
      '<button class="btn btn-ghost" data-act="export">' + icon('download', 17) + u.esc(t('p.export')) + '</button>' +
      '<button class="btn btn-ghost" data-act="import">' + icon('upload', 17) + u.esc(t('p.import')) + '</button>' +
      '<button class="btn btn-danger" data-act="reset">' + icon('trash', 17) + u.esc(t('p.reset')) + '</button>' +
      '<input type="file" accept="application/json,.json" hidden data-host="importfile">';
    root2.appendChild(dataCard);

    /* ----- student fields (auto-save) ----- */
    var host = root2.querySelector('[data-host="student"]');
    host.innerHTML =
      '<div class="field"><label for="pf-degree">' + u.esc(t('p.degree')) + '</label>' +
      '<input class="input" id="pf-degree" list="degree-list" value="' + u.esc(p.degree) + '" placeholder="' + u.esc(t('p.degreePh')) + '">' +
      '<datalist id="degree-list"><option value="' + u.esc(t('dl.bachelor')) + '"></option>' +
      '<option value="' + u.esc(t('dl.master')) + '"></option>' +
      '<option value="' + u.esc(t('dl.phd')) + '"></option></datalist></div>' +
      '<div class="field"><label for="pf-spec">' + u.esc(t('p.specialty')) + '</label>' +
      '<input class="input" id="pf-spec" value="' + u.esc(p.specialty) + '" placeholder="' + u.esc(t('p.specialtyPh')) + '"></div>' +
      '<div class="field" style="margin-bottom:0"><label for="pf-group">' + u.esc(t('p.group')) + '</label>' +
      '<input class="input" id="pf-group" value="' + u.esc(p.group) + '" placeholder="' + u.esc(t('p.groupPh')) + '"></div>';

    var saveProfile = u.debounce(function () {
      SL.store.setProfile({
        degree: host.querySelector('#pf-degree').value,
        specialty: host.querySelector('#pf-spec').value,
        group: host.querySelector('#pf-group').value,
      });
    }, 400);
    ['pf-degree', 'pf-spec', 'pf-group'].forEach(function (id) {
      host.querySelector('#' + id).addEventListener('input', saveProfile);
    });

    /* ----- actions (delegation re-bound safely on every render) ----- */
    if (root2._onClick) root2.removeEventListener('click', root2._onClick);
    root2._onClick = function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.getAttribute('data-act');
      if (a === 'picksem') {
        openSemesterPicker(root2);
      } else if (a === 'mngcur') {
        var cur2 = SL.store.currentSemester();
        if (cur2) SL.ui.openSubjectManager(cur2.sem.id);
      } else if (a === 'managesem') {
        openSemesterActions(act.getAttribute('data-sid'), root2);
      } else if (a === 'export') {
        SL.store.exportJSON().then(function (json) {
          var blob = new Blob([json], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = 'study-live-backup.json';
          link.click();
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 400);
        });
      } else if (a === 'import') {
        var fi = root2.querySelector('[data-host="importfile"]');
        fi.click();
      } else if (a === 'reset') {
        SL.ui.confirmSheet({ title: t('p.resetQ'), message: t('p.resetHint'), danger: true }).then(function (yes) {
          if (yes) {
            SL.store.resetAll();
            render(root2);
            SL.router.refresh();
          }
        });
      }
    };
    root2.addEventListener('click', root2._onClick);

    var importInput = root2.querySelector('[data-host="importfile"]');
    importInput.addEventListener('change', function () {
      var f = importInput.files && importInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        SL.store.importJSON(String(reader.result)).then(function (res) {
          if (res.ok) {
            SL.ui.toast(t('toast.importedN', { t: res.tasks, n: res.notes }));
            render(root2);
            SL.router.refresh();
          } else {
            SL.ui.toast(t('toast.importBad'), 'error');
          }
        });
      };
      reader.readAsText(f);
      importInput.value = '';
    });

    /* ---------- cloud sync ---------- */

    function cloudCard(root2) {
      var el = document.createElement('div');
      el.className = 'card card-pad cloud-card';

      function draw() {
        if (!SL.supabase || !SL.supabase.ENABLED) {
          el.innerHTML =
            '<div class="cloud-disabled">' +
            '<div class="cloud-disabled-icon">' + icon('cloud', 28) + '</div>' +
            '<div class="cloud-disabled-text">' + u.esc(t('toast.cloudDisabled')) + '</div>' +
            '</div>';
          return;
        }

        var connected = SL.supabase.isConnected();
        var user = connected ? SL.supabase.getUser() : null;
        var email = user && user.email ? user.email : '';
        var fullName = user && user.user_metadata && user.user_metadata.full_name
          ? user.user_metadata.full_name
          : email;
        var avatarUrl = user && user.user_metadata && user.user_metadata.avatar_url
          ? user.user_metadata.avatar_url : null;

        if (!connected) {
          el.innerHTML =
            '<div class="cloud-login">' +
            '<div class="cloud-login-icon">' + icon('cloud', 40) + '</div>' +
            '<div class="cloud-login-title">' + u.esc(t('cloud.title')) + '</div>' +
            '<div class="cloud-login-sub">' + u.esc(t('cloud.subtitle')) + '</div>' +
            '<div class="cloud-login-hint">' + u.esc(t('cloud.dataSafe')) + '</div>' +
            '<button class="cloud-google-btn" data-act="gsignin">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>' +
            u.esc(t('cloud.signIn')) + '</button>' +
            '<p class="hint cloud-merge">' + u.esc(t('cloud.mergeNote')) + '</p>' +
            '</div>';
          var btn = el.querySelector('[data-act="gsignin"]');
          if (btn) btn.addEventListener('click', onSignIn);
          return;
        }

        // Connected state
        var avatarHtml = avatarUrl
          ? '<img src="' + u.esc(avatarUrl) + '" alt="" class="cloud-avatar">'
          : '<div class="cloud-avatar cloud-avatar-fallback">' + icon('profile', 22) + '</div>';

        el.innerHTML =
          '<div class="cloud-connected">' +
          '<div class="cloud-user-row">' + avatarHtml +
          '<div class="cloud-user-info">' +
          '<div class="cloud-user-name">' + u.esc(fullName) + '</div>' +
          '<div class="cloud-user-email">' + u.esc(email) + '</div>' +
          '</div>' +
          '<span class="cloud-badge">' + icon('check', 12) + u.esc(t('cloud.connected')) + '</span>' +
          '</div>' +
          '<div class="cloud-divider"></div>' +
          '<div class="cloud-actions">' +
          '<button class="btn btn-ghost btn-sm" data-act="syncnow">' + icon('sync', 16) + u.esc(t('cloud.syncNow')) + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="signout">' + icon('logout', 16) + u.esc(t('cloud.signOut')) + '</button>' +
          '<button class="btn btn-danger btn-sm" data-act="deleteaccount">' + icon('trash', 16) + u.esc(t('cloud.deleteAccount')) + '</button>' +
          '</div>' +
          '</div>';

        el.querySelector('[data-act="syncnow"]').addEventListener('click', onSync);
        el.querySelector('[data-act="signout"]').addEventListener('click', onSignOut);
        el.querySelector('[data-act="deleteaccount"]').addEventListener('click', onDeleteAccount);
      }

      function onSignIn() {
        SL.supabase.signInWithGoogle().catch(function () {
          SL.ui.toast(t('toast.cloudSyncFail'), 'error');
        });
      }

      function onSync() {
        var btn = el.querySelector('[data-act="syncnow"]');
        btn.disabled = true;
        btn.innerHTML = icon('sync', 16) + u.esc(t('cloud.syncing'));
        SL.supabase.syncToCloud().then(function () {
          return SL.supabase.syncFromCloud();
        }).then(function () {
          SL.ui.toast(t('toast.cloudSyncSuccess'));
        }).catch(function () {
          SL.ui.toast(t('toast.cloudSyncFail'), 'error');
        }).then(function () {
          btn.disabled = false;
          draw();
        });
      }

      function onSignOut() {
        SL.ui.confirmSheet({
          title: t('cloud.signOut'),
          message: t('cloud.signOutConfirm'),
          danger: false,
          confirmLabel: t('cloud.signOut'),
        }).then(function (yes) {
          if (yes) {
            SL.supabase.signOut().then(function () { draw(); });
          }
        });
      }

      function onDeleteAccount() {
        SL.ui.confirmSheet({
          title: t('cloud.deleteAccount'),
          message: t('cloud.deleteAccountConfirm'),
          danger: true,
        }).then(function (yes) {
          if (yes) {
            SL.supabase.deleteUser().then(function () {
              SL.store.resetAll();
              draw();
            }).catch(function () {
              SL.ui.toast(t('cloud.deleteAccountError'), 'error');
            });
          }
        });
      }


      draw();
      if (SL.supabase && SL.supabase.onAuthChange) {
        SL.supabase.onAuthChange(function () { draw(); });
      }
      return el;
    }

    var cloudTitle = document.createElement('h2');
    cloudTitle.className = 'section-title';
    cloudTitle.innerHTML = icon('cloud', 14) + u.esc(t('cloud.title'));
    root2.appendChild(cloudTitle);
    root2.appendChild(cloudCard(root2));

    // vault lock (change PIN with hint)
    var vaultTitle = document.createElement('h2');
    vaultTitle.className = 'section-title';
    vaultTitle.innerHTML = icon('lock', 14) + u.esc(t('p.vault'));
    root2.appendChild(vaultTitle);

    var vaultCard = document.createElement('div');
    vaultCard.className = 'card card-pad';
    root2.appendChild(vaultCard);

    if (!SL.store.vaultHasPin()) {
      vaultCard.innerHTML = '<div class="g-empty-line">' + u.esc(t('p.vaultNotSet')) + '</div>';
    } else {
      renderVaultChange();
    }

    function renderVaultChange() {
      vaultCard.innerHTML =
        '<div class="field" style="margin-bottom:10px"><label for="pv-hint">' + u.esc(t('p.vaultHintLabel')) + '</label>' +
        '<input class="input" id="pv-hint" dir="auto" placeholder="' + u.esc(t('p.vaultHintPh')) + '">' +
        '<span class="field-error" role="alert" data-host="verr" hidden></span></div>' +
        '<button class="btn btn-ghost" data-act="vcontinue">' + icon('check', 16) + u.esc(t('p.vaultContinue')) + '</button>';
      var hintInput = vaultCard.querySelector('#pv-hint');
      var verr = vaultCard.querySelector('[data-host="verr"]');
      vaultCard.querySelector('[data-act="vcontinue"]').addEventListener('click', function () {
        if (hintInput.value.trim() !== SL.store.vaultHint()) {
          verr.textContent = t('p.vaultHintWrong');
          verr.hidden = false;
          return;
        }
        renderNewPin();
      });
      hintInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') vaultCard.querySelector('[data-act="vcontinue"]').click();
      });
    }

    function renderNewPin() {
      vaultCard.innerHTML =
        '<div class="field" style="margin-bottom:10px"><label for="pv-pin1">' + u.esc(t('p.vaultNewPin')) + '</label>' +
        '<input class="input" id="pv-pin1" type="password" inputmode="numeric" maxlength="4" dir="ltr"></div>' +
        '<div class="field" style="margin-bottom:10px"><label for="pv-pin2">' + u.esc(t('p.vaultNewPinConfirm')) + '</label>' +
        '<input class="input" id="pv-pin2" type="password" inputmode="numeric" maxlength="4" dir="ltr">' +
        '<span class="field-error" role="alert" data-host="perr" hidden></span></div>' +
        '<button class="btn btn-primary" data-act="vsave">' + icon('check', 16) + u.esc(t('p.vaultSave')) + '</button>';
      var perr = vaultCard.querySelector('[data-host="perr"]');
      vaultCard.querySelector('[data-act="vsave"]').addEventListener('click', function () {
        var p1 = vaultCard.querySelector('#pv-pin1').value;
        var p2 = vaultCard.querySelector('#pv-pin2').value;
        if (!/^\d{4}$/.test(p1)) {
          perr.textContent = t('v.need4');
          perr.hidden = false;
          return;
        }
        if (p1 !== p2) {
          perr.textContent = t('v.pinMismatch');
          perr.hidden = false;
          return;
        }
        SL.store.changeVaultPin(SL.store.vaultHint(), p1).then(function (res) {
          // hint verified in the previous step
          if (!res.ok) {
            perr.textContent = t('p.vaultHintWrong');
            perr.hidden = false;
            return;
          }
          SL.ui.toast(t('p.vaultChanged'));
          render(root2);
        });
      });
    }

    // about
    var aboutTitle = document.createElement('h2');
    aboutTitle.className = 'section-title';
    aboutTitle.innerHTML = icon('logo', 14) + u.esc(t('p.about'));
    root2.appendChild(aboutTitle);

    var aboutCard = document.createElement('div');
    aboutCard.className = 'card card-pad';
    aboutCard.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<span class="brand-mark">' + icon('logo', 20) + 'Study Live</span>' +
      '<span class="day-count">' + u.esc(t('p.version', { v: SL.VERSION })) + '</span>' +
      '<span class="day-count" data-host="storage"></span>' +
      '</div>';
    root2.appendChild(aboutCard);
    var storageHost = aboutCard.querySelector('[data-host="storage"]');
    if (root.navigator.storage && root.navigator.storage.estimate) {
      root.navigator.storage
        .estimate()
        .then(function (est) {
          var mb = (est.usage || 0) / 1048576;
          storageHost.textContent = t('p.storage', { mb: mb.toFixed(1) });
        })
        .catch(function () {});
    }
  }

  SL.pages = SL.pages || {};
  SL.pages.profile = {
    id: 'profile',
    labelKey: 'nav.profile',
    icon: 'profile',
    render: render,
  };
})(typeof window !== 'undefined' ? window : globalThis);

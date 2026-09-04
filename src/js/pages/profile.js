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

  /* ---------- active tab state ---------- */
  var activeProfileTab = 'academic';
  var expandedYears = {};

  /* ---------- main render ---------- */

  function render(root2) {
    var st = SL.store.get();
    var p = st.profile || {};
    var cur = SL.store.currentSemester();
    var hasStruct = SL.store.hasStructure();

    // Default to student info if no academic structure yet
    if (!hasStruct && activeProfileTab === 'academic') {
      activeProfileTab = 'academic';
    }

    var connected = SL.supabase && SL.supabase.isConnected && SL.supabase.isConnected();
    var user = connected ? SL.supabase.getUser() : null;
    var userEmail = user && user.email ? user.email : '';
    var userFullName = user && user.user_metadata && user.user_metadata.full_name ? user.user_metadata.full_name : '';
    var avatarUrl = user && user.user_metadata && user.user_metadata.avatar_url ? user.user_metadata.avatar_url : null;

    // Student identity resolution
    var studentName = (p.name || userFullName || '').trim();
    var displayDegree = (p.degree || '').trim();
    var displaySpec = (p.specialty || '').trim();
    var displayGroup = (p.group || '').trim();
    var displayUniv = (p.university || '').trim();
    var displayId = (p.studentId || '').trim();

    var cardMainTitle = studentName || (displayDegree ? displayDegree + (displaySpec ? ' · ' + displaySpec : '') : t('p.title'));
    var initialLetter = (studentName || displayDegree || 'S').charAt(0).toUpperCase();

    // Current position text
    var nowHTML = cur
      ? t('p.now', {
          year: SL.i18n.yearName(cur.yearIndex + 1),
          sem: SL.i18n.semName(cur.semIndex + 1),
        })
      : t(hasStruct ? 's.noCurrent' : 'p.noStructure');

    // Calculate academic progress
    var totalSems = 0;
    var doneSems = 0;
    if (hasStruct) {
      st.academic.years.forEach(function (y) {
        y.semesters.forEach(function (s) {
          totalSems++;
          if (s.status === 'done') doneSems++;
        });
      });
    }
    var progressPct = totalSems > 0 ? Math.round((doneSems / totalSems) * 100) : 0;

    // Build ID card Avatar HTML
    var avatarHtml = avatarUrl
      ? '<img src="' + u.esc(avatarUrl) + '" alt="" class="id-avatar">'
      : '<div class="id-avatar">' + (studentName ? u.esc(initialLetter) : icon('profile', 28)) + '</div>';

    // Build ID card Pills
    var pillsHtml = [
      displayDegree ? '<span class="id-pill id-pill-degree">' + icon('bookmark', 12) + u.esc(displayDegree) + '</span>' : '',
      displaySpec ? '<span class="id-pill id-pill-spec">' + icon('tasks', 12) + u.esc(displaySpec) + '</span>' : '',
      displayGroup ? '<span class="id-pill id-pill-group">' + icon('tag', 12) + u.esc(displayGroup) + '</span>' : '',
      displayUniv ? '<span class="id-pill">' + icon('globe', 12) + u.esc(displayUniv) + '</span>' : '',
      displayId ? '<span class="id-pill">' + icon('check', 12) + u.esc(displayId) + '</span>' : '',
    ].filter(Boolean).join('');

    root2.innerHTML =
      '<h1 class="page-title">' + u.esc(t('p.title')) + '</h1>' +

      '<!-- Collegiate Student ID Card -->' +
      '<div class="profile-id-card" data-host="id-card">' +
      '<div class="id-card-top">' +
      '<span class="id-brand-badge">' + icon('logo', 13) + u.esc(t('p.idCardTitle')) + '</span>' +
      '<span class="id-verified-chip">' + icon('check', 11) + u.esc(t('p.verifiedStudent')) + '</span>' +
      '</div>' +
      '<div class="id-card-main">' +
      '<div class="id-avatar-wrap">' + avatarHtml + '</div>' +
      '<div class="id-student-info">' +
      '<div class="id-student-name" data-host="id-name">' + u.esc(cardMainTitle) + '</div>' +
      '<div class="id-pills-row" data-host="id-pills">' + (pillsHtml || '<span class="id-pill">' + u.esc(t('p.student')) + '</span>') + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="id-card-footer">' +
      '<span class="id-pos-indicator">' +
      '<span class="id-pos-dot" style="' + (!cur ? 'background:var(--ink-muted);box-shadow:none;' : '') + '"></span>' +
      '<span data-host="id-pos">' + u.esc(nowHTML) + '</span>' +
      '</span>' +
      '<button type="button" class="id-quick-edit-btn" data-act="goto-student">' +
      icon('pencil', 12) + u.esc(t('p.editProfile')) + '</button>' +
      '</div>' +
      '</div>' +

      '<!-- Profile Segmented Tabs Bar -->' +
      '<div class="profile-tabs-bar" role="tablist">' +
      '<button type="button" class="profile-tab-btn ' + (activeProfileTab === 'academic' ? 'active' : '') + '" data-tab="academic" role="tab">' +
      icon('bookmark', 15) + u.esc(t('p.tabAcademic')) + '</button>' +
      '<button type="button" class="profile-tab-btn ' + (activeProfileTab === 'student' ? 'active' : '') + '" data-tab="student" role="tab">' +
      icon('profile', 15) + u.esc(t('p.tabStudent')) + '</button>' +
      '<button type="button" class="profile-tab-btn ' + (activeProfileTab === 'account' ? 'active' : '') + '" data-tab="account" role="tab">' +
      icon('cloud', 15) + u.esc(t('p.tabAccount')) + '</button>' +
      '<button type="button" class="profile-tab-btn ' + (activeProfileTab === 'prefs' ? 'active' : '') + '" data-tab="prefs" role="tab">' +
      icon('globe', 15) + u.esc(t('p.tabPrefs')) + '</button>' +
      '</div>' +

      '<!-- Tab Panes Container -->' +
      '<div class="profile-panes-wrap">' +
      '<div class="profile-pane ' + (activeProfileTab === 'academic' ? 'active' : '') + '" data-pane="academic"></div>' +
      '<div class="profile-pane ' + (activeProfileTab === 'student' ? 'active' : '') + '" data-pane="student"></div>' +
      '<div class="profile-pane ' + (activeProfileTab === 'account' ? 'active' : '') + '" data-pane="account"></div>' +
      '<div class="profile-pane ' + (activeProfileTab === 'prefs' ? 'active' : '') + '" data-pane="prefs"></div>' +
      '</div>' +
      '<input type="file" accept="application/json,.json" hidden data-host="importfile">';

    var paneAcademic = root2.querySelector('[data-pane="academic"]');
    var paneStudent = root2.querySelector('[data-pane="student"]');
    var paneAccount = root2.querySelector('[data-pane="account"]');
    var panePrefs = root2.querySelector('[data-pane="prefs"]');

    /* ============================================================
       PANE 1: ACADEMIC JOURNEY
       ============================================================ */
    if (!hasStruct) {
      paneAcademic.appendChild(setupCard(root2));
    } else {
      // 1. Spotlight Card
      var spotlightCard = document.createElement('div');
      spotlightCard.className = 'card current-spotlight-card';
      var curSubs = cur ? SL.store.subjectsOf(cur.sem.id) : [];
      spotlightCard.innerHTML =
        '<div class="spotlight-top">' +
        '<span class="spotlight-badge">' + icon('bookmark', 13) + u.esc(t('p.currentSemBadge')) + '</span>' +
        (cur ? '<span class="status-chip status-current">' + u.esc(t('st.current')) + '</span>' : '') +
        '</div>' +
        '<div class="spotlight-title">' +
        u.esc(cur ? semTitle(cur.yearIndex, cur.semIndex) : t('s.noCurrent')) +
        '</div>' +
        '<div class="spotlight-sub">' +
        u.esc(cur ? t('p.subjectsCount', { n: curSubs.length }) : t('p.noStructure')) +
        '</div>' +
        '<div class="spotlight-actions">' +
        (cur ? '<button class="btn btn-primary" data-act="mngcur">' + icon('tag', 16) + u.esc(t('p.openSubjects')) + '</button>' : '') +
        '<button class="btn ' + (cur ? 'btn-ghost' : 'btn-primary') + '" data-act="picksem">' +
        icon('sync', 16) + u.esc(t('p.changeSem')) + '</button>' +
        '</div>';
      paneAcademic.appendChild(spotlightCard);

      // 2. Curriculum Progress Card
      var progCard = document.createElement('div');
      progCard.className = 'card curriculum-card';
      progCard.innerHTML =
        '<div class="curriculum-head">' +
        '<span class="curriculum-title">' + icon('check', 14) + ' ' + u.esc(t('p.progressTotal')) + '</span>' +
        '<span class="curriculum-pct">' + progressPct + '%</span>' +
        '</div>' +
        '<div class="curriculum-track"><div class="curriculum-fill" style="width:' + progressPct + '%"></div></div>' +
        '<div class="curriculum-meta">' + u.esc(t('p.progressSems', { done: doneSems, total: totalSems })) + '</div>';
      paneAcademic.appendChild(progCard);

      // 3. Smart Academic Structure Accordion
      var structWrap = document.createElement('div');
      structWrap.innerHTML =
        '<div class="structure-header-bar">' +
        '<h2 class="section-title" style="margin:0">' + icon('tasks', 14) + u.esc(t('p.academicOverview')) + '</h2>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="toggleall" style="font-size:12px;padding:4px 10px">' +
        icon('chevD', 13) + '<span data-host="toggleall-text">' + u.esc(t('p.expandAll')) + '</span></button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="editstruct" style="font-size:12px;padding:4px 10px">' +
        icon('pencil', 13) + u.esc(t('p.editStructure')) + '</button>' +
        '</div>' +
        '</div>';

      st.academic.years.forEach(function (y, yi) {
        var isCurYear = cur && cur.yearIndex === yi;
        var yearSubsCount = 0;
        y.semesters.forEach(function (s) {
          yearSubsCount += SL.store.subjectsOf(s.id).length;
        });

        // Current year is open by default unless user explicitly collapsed it
        var isOpen = expandedYears[y.id] != null ? expandedYears[y.id] : isCurYear;

        var yCard = document.createElement('div');
        yCard.className = 'card year-accordion-card ' + (isCurYear ? 'active-year ' : '') + (isOpen ? 'open' : '');
        yCard.setAttribute('data-yid', y.id);

        yCard.innerHTML =
          '<button type="button" class="year-accordion-head" data-act="toggle-year" data-yid="' + y.id + '">' +
          '<span class="year-acc-title">' + u.esc(SL.i18n.yearName(yi + 1)) + '</span>' +
          '<span class="year-acc-summary">' + u.esc(t('p.yearSummary', { sems: y.semesters.length, subs: yearSubsCount })) + '</span>' +
          (isCurYear ? '<span class="year-acc-tag">' + icon('bookmark', 11) + u.esc(t('p.activeYear')) + '</span>' : '') +
          '<span class="year-acc-chevron">' + icon('chevD', 14) + '</span>' +
          '</button>' +
          '<div class="year-accordion-body">' +
          y.semesters
            .map(function (s, si) {
              var cnt = SL.store.subjectsOf(s.id).length;
              var isCurSem = cur && cur.sem.id === s.id;
              return (
                '<div class="sem-hub-row">' +
                '<span class="sem-hub-title">' + u.esc(SL.i18n.semName(si + 1)) + '</span>' +
                '<button type="button" class="sem-hub-subs-btn" data-act="mngsem-subs" data-sid="' + s.id + '" title="' + u.esc(t('p.openSubjects')) + '">' +
                icon('tag', 12) + u.esc(t('p.subjectsCount', { n: cnt })) + '</button>' +
                '<div class="sem-hub-actions">' +
                '<span class="status-chip status-' + s.status + '">' + u.esc(t('st.' + s.status)) + '</span>' +
                (!isCurSem
                  ? '<button type="button" class="mini-btn" data-act="quick-cur" data-sid="' + s.id + '" title="' + u.esc(t('p.markCurrent')) + '" aria-label="' + u.esc(t('p.markCurrent')) + '">' +
                    icon('bookmark', 14) + '</button>'
                  : '') +
                '<button type="button" class="mini-btn" data-act="managesem" data-sid="' + s.id + '" title="' + u.esc(t('a.edit')) + '" aria-label="' + u.esc(t('a.edit')) + '">' +
                icon('pencil', 14) + '</button>' +
                '</div>' +
                '</div>'
              );
            })
            .join('') +
          '</div>';

        structWrap.appendChild(yCard);
      });

      paneAcademic.appendChild(structWrap);
    }

    /* ============================================================
       PANE 2: STUDENT DETAILS
       ============================================================ */
    var studentFormCard = document.createElement('div');
    studentFormCard.className = 'card student-form-card';
    studentFormCard.innerHTML =
      '<div class="student-form-head">' +
      '<h2 class="section-title" style="margin:0">' + icon('profile', 15) + u.esc(t('p.student')) + '</h2>' +
      '<span class="auto-save-pill" data-host="saved-pill">' + icon('check', 11) + ' ' + u.esc(t('p.autoSaved')) + '</span>' +
      '</div>' +
      '<div class="field"><label for="pf-name">' + u.esc(t('p.studentName')) + '</label>' +
      '<input class="input" id="pf-name" value="' + u.esc(p.name || '') + '" placeholder="' + u.esc(t('p.studentNamePh')) + '"></div>' +
      '<div class="field"><label for="pf-univ">' + u.esc(t('p.university')) + '</label>' +
      '<input class="input" id="pf-univ" value="' + u.esc(p.university || '') + '" placeholder="' + u.esc(t('p.universityPh')) + '"></div>' +
      '<div class="field"><label for="pf-degree">' + u.esc(t('p.degree')) + '</label>' +
      '<input class="input" id="pf-degree" list="degree-list" value="' + u.esc(p.degree || '') + '" placeholder="' + u.esc(t('p.degreePh')) + '">' +
      '<datalist id="degree-list">' +
      '<option value="' + u.esc(t('dl.bachelor')) + '"></option>' +
      '<option value="' + u.esc(t('dl.master')) + '"></option>' +
      '<option value="' + u.esc(t('dl.phd')) + '"></option>' +
      '</datalist></div>' +
      '<div class="field"><label for="pf-spec">' + u.esc(t('p.specialty')) + '</label>' +
      '<input class="input" id="pf-spec" value="' + u.esc(p.specialty || '') + '" placeholder="' + u.esc(t('p.specialtyPh')) + '"></div>' +
      '<div class="field"><label for="pf-group">' + u.esc(t('p.group')) + '</label>' +
      '<input class="input" id="pf-group" value="' + u.esc(p.group || '') + '" placeholder="' + u.esc(t('p.groupPh')) + '"></div>' +
      '<div class="field" style="margin-bottom:0"><label for="pf-stuid">' + u.esc(t('p.studentId')) + '</label>' +
      '<input class="input" id="pf-stuid" value="' + u.esc(p.studentId || '') + '" placeholder="' + u.esc(t('p.studentIdPh')) + '"></div>';

    paneStudent.appendChild(studentFormCard);

    // Live debounced auto-save for student details
    var savedPill = studentFormCard.querySelector('[data-host="saved-pill"]');
    var hidePillTimer = null;

    var saveProfile = u.debounce(function () {
      var newName = studentFormCard.querySelector('#pf-name').value;
      var newUniv = studentFormCard.querySelector('#pf-univ').value;
      var newDegree = studentFormCard.querySelector('#pf-degree').value;
      var newSpec = studentFormCard.querySelector('#pf-spec').value;
      var newGroup = studentFormCard.querySelector('#pf-group').value;
      var newId = studentFormCard.querySelector('#pf-stuid').value;

      SL.store.setProfile({
        name: newName,
        university: newUniv,
        degree: newDegree,
        specialty: newSpec,
        group: newGroup,
        studentId: newId,
      });

      // Update ID card live in DOM without full rerender
      var idNameEl = root2.querySelector('[data-host="id-name"]');
      var idPillsEl = root2.querySelector('[data-host="id-pills"]');
      if (idNameEl) {
        idNameEl.textContent = newName.trim() || (newDegree ? newDegree + (newSpec ? ' · ' + newSpec : '') : t('p.title'));
      }
      if (idPillsEl) {
        var updatedPills = [
          newDegree ? '<span class="id-pill id-pill-degree">' + icon('bookmark', 12) + u.esc(newDegree) + '</span>' : '',
          newSpec ? '<span class="id-pill id-pill-spec">' + icon('tasks', 12) + u.esc(newSpec) + '</span>' : '',
          newGroup ? '<span class="id-pill id-pill-group">' + icon('tag', 12) + u.esc(newGroup) + '</span>' : '',
          newUniv ? '<span class="id-pill">' + icon('globe', 12) + u.esc(newUniv) + '</span>' : '',
          newId ? '<span class="id-pill">' + icon('check', 12) + u.esc(newId) + '</span>' : '',
        ].filter(Boolean).join('');
        idPillsEl.innerHTML = updatedPills || '<span class="id-pill">' + u.esc(t('p.student')) + '</span>';
      }

      // Flash auto-saved indicator
      if (savedPill) {
        savedPill.classList.add('visible');
        clearTimeout(hidePillTimer);
        hidePillTimer = setTimeout(function () {
          savedPill.classList.remove('visible');
        }, 1800);
      }
    }, 350);

    ['pf-name', 'pf-univ', 'pf-degree', 'pf-spec', 'pf-group', 'pf-stuid'].forEach(function (id) {
      var inp = studentFormCard.querySelector('#' + id);
      if (inp) inp.addEventListener('input', saveProfile);
    });

    /* ============================================================
       PANE 3: ACCOUNT & CLOUD SECURITY
       ============================================================ */
    // Cloud Sync
    var cloudTitle = document.createElement('h2');
    cloudTitle.className = 'section-title';
    cloudTitle.innerHTML = icon('cloud', 14) + u.esc(t('cloud.title'));
    paneAccount.appendChild(cloudTitle);
    paneAccount.appendChild(cloudCard(root2));

    // Vault Lock
    var vaultTitle = document.createElement('h2');
    vaultTitle.className = 'section-title';
    vaultTitle.style.marginTop = '18px';
    vaultTitle.innerHTML = icon('lock', 14) + u.esc(t('p.vault'));
    paneAccount.appendChild(vaultTitle);

    var vaultCard = document.createElement('div');
    vaultCard.className = 'card card-pad';
    paneAccount.appendChild(vaultCard);

    if (!SL.store.vaultHasPin()) {
      vaultCard.innerHTML =
        '<div class="g-empty-line" style="margin-bottom:12px">' + u.esc(t('p.vaultNotSet')) + '</div>' +
        '<button type="button" class="btn btn-ghost btn-block" data-act="goto-vault">' +
        icon('lock', 16) + u.esc(t('v.title')) + '</button>';
      var gvBtn = vaultCard.querySelector('[data-act="goto-vault"]');
      if (gvBtn) {
        gvBtn.addEventListener('click', function () {
          SL.router.go('vault');
        });
      }
    } else {
      renderVaultChange(vaultCard, root2);
    }

    /* ============================================================
       PANE 4: PREFERENCES & DATA
       ============================================================ */
    // Preferences: Week start
    var prefsTitle = document.createElement('h2');
    prefsTitle.className = 'section-title';
    prefsTitle.innerHTML = icon('globe', 14) + u.esc(t('p.prefs'));
    panePrefs.appendChild(prefsTitle);

    var prefsCard = document.createElement('div');
    prefsCard.className = 'card card-pad';
    prefsCard.innerHTML =
      '<div class="field" style="margin-bottom:0"><label for="pf-ws">' + u.esc(t('p.weekStart')) + '</label>' +
      '<select class="select" id="pf-ws">' +
      '<option value="1">' + u.esc(t('ws.mon')) + '</option>' +
      '<option value="6">' + u.esc(t('ws.sat')) + '</option>' +
      '<option value="0">' + u.esc(t('ws.sun')) + '</option>' +
      '</select></div>';
    panePrefs.appendChild(prefsCard);

    var wsSelect = prefsCard.querySelector('#pf-ws');
    wsSelect.value = String(st.settings.weekStart == null ? 1 : st.settings.weekStart);
    wsSelect.addEventListener('change', function () {
      SL.store.setWeekStart(parseInt(wsSelect.value, 10));
      render(root2);
    });

    // Backup & Data
    var dataTitle = document.createElement('h2');
    dataTitle.className = 'section-title';
    dataTitle.style.marginTop = '18px';
    dataTitle.innerHTML = icon('download', 14) + u.esc(t('p.data'));
    panePrefs.appendChild(dataTitle);

    var dataCard = document.createElement('div');
    dataCard.className = 'card card-pad';
    dataCard.innerHTML =
      '<p class="hint-line" style="margin-bottom:12px">' + u.esc(t('p.backupDesc')) + '</p>' +
      '<div class="data-actions">' +
      '<button class="btn btn-ghost" data-act="export">' + icon('download', 17) + u.esc(t('p.export')) + '</button>' +
      '<button class="btn btn-ghost" data-act="import">' + icon('upload', 17) + u.esc(t('p.import')) + '</button>' +
      '</div>';
    panePrefs.appendChild(dataCard);

    // Danger Zone
    var dangerCard = document.createElement('div');
    dangerCard.className = 'card danger-zone-card';
    dangerCard.innerHTML =
      '<div class="danger-zone-head">' + icon('trash', 16) + u.esc(t('p.dangerZone')) + '</div>' +
      '<div class="danger-zone-note">' + u.esc(t('p.dangerZoneDesc')) + '</div>' +
      '<button class="btn btn-danger btn-block" data-act="reset">' + icon('trash', 16) + u.esc(t('p.reset')) + '</button>';
    panePrefs.appendChild(dangerCard);

    // About
    var aboutTitle = document.createElement('h2');
    aboutTitle.className = 'section-title';
    aboutTitle.style.marginTop = '18px';
    aboutTitle.innerHTML = icon('logo', 14) + u.esc(t('p.about'));
    panePrefs.appendChild(aboutTitle);

    var aboutCard = document.createElement('div');
    aboutCard.className = 'card card-pad';
    aboutCard.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<span class="brand-mark">' + icon('logo', 20) + 'Study Live</span>' +
      '<span class="day-count">' + u.esc(t('p.version', { v: SL.VERSION })) + '</span>' +
      '<span class="day-count" data-host="storage"></span>' +
      '</div>';
    panePrefs.appendChild(aboutCard);

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

    /* ============================================================
       CENTRAL EVENT DELEGATION
       ============================================================ */
    if (root2._onClick) root2.removeEventListener('click', root2._onClick);
    root2._onClick = function (e) {
      // Tab switching
      var tabBtn = e.target.closest('[data-tab]');
      if (tabBtn) {
        var tabId = tabBtn.getAttribute('data-tab');
        if (tabId) {
          activeProfileTab = tabId;
          root2.querySelectorAll('.profile-tab-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
          });
          root2.querySelectorAll('.profile-pane').forEach(function (pane) {
            pane.classList.toggle('active', pane.getAttribute('data-pane') === tabId);
          });
          return;
        }
      }

      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.getAttribute('data-act');

      if (a === 'goto-student') {
        activeProfileTab = 'student';
        root2.querySelectorAll('.profile-tab-btn').forEach(function (btn) {
          btn.classList.toggle('active', btn.getAttribute('data-tab') === 'student');
        });
        root2.querySelectorAll('.profile-pane').forEach(function (pane) {
          pane.classList.toggle('active', pane.getAttribute('data-pane') === 'student');
        });
        var nameInput = root2.querySelector('#pf-name');
        if (nameInput) nameInput.focus();
      } else if (a === 'toggle-year') {
        var yid = act.getAttribute('data-yid');
        var card = root2.querySelector('.year-accordion-card[data-yid="' + yid + '"]');
        if (card) {
          var willOpen = !card.classList.contains('open');
          card.classList.toggle('open', willOpen);
          expandedYears[yid] = willOpen;
        }
      } else if (a === 'toggleall') {
        var allCards = root2.querySelectorAll('.year-accordion-card');
        var anyClosed = Array.prototype.some.call(allCards, function (c) {
          return !c.classList.contains('open');
        });
        allCards.forEach(function (c) {
          c.classList.toggle('open', anyClosed);
          var id = c.getAttribute('data-yid');
          if (id) expandedYears[id] = anyClosed;
        });
        var toggleText = root2.querySelector('[data-host="toggleall-text"]');
        if (toggleText) {
          toggleText.textContent = anyClosed ? t('p.collapseAll') : t('p.expandAll');
        }
      } else if (a === 'quick-cur') {
        var sidCur = act.getAttribute('data-sid');
        if (sidCur) {
          SL.store.setSemesterStatus(sidCur, 'current');
          SL.ui.toast(t('toast.saved'));
          render(root2);
        }
      } else if (a === 'mngcur') {
        var cur2 = SL.store.currentSemester();
        if (cur2) SL.ui.openSubjectManager(cur2.sem.id);
      } else if (a === 'mngsem-subs') {
        var targetSid = act.getAttribute('data-sid');
        if (targetSid) SL.ui.openSubjectManager(targetSid);
      } else if (a === 'picksem') {
        openSemesterPicker(root2);
      } else if (a === 'editstruct') {
        openStructureEditor(root2);
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
        if (fi) fi.click();
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
    if (importInput) {
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
    }

    /* ---------- Cloud card builder ---------- */
    function cloudCard(root3) {
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

        var isConn = SL.supabase.isConnected();
        var uObj = isConn ? SL.supabase.getUser() : null;
        var em = uObj && uObj.email ? uObj.email : '';
        var fn = uObj && uObj.user_metadata && uObj.user_metadata.full_name
          ? uObj.user_metadata.full_name
          : em;
        var av = uObj && uObj.user_metadata && uObj.user_metadata.avatar_url
          ? uObj.user_metadata.avatar_url
          : null;

        if (!isConn) {
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
        var avHtml = av
          ? '<img src="' + u.esc(av) + '" alt="" class="cloud-avatar">'
          : '<div class="cloud-avatar cloud-avatar-fallback">' + icon('profile', 22) + '</div>';

        el.innerHTML =
          '<div class="cloud-connected">' +
          '<div class="cloud-user-row">' + avHtml +
          '<div class="cloud-user-info">' +
          '<div class="cloud-user-name">' + u.esc(fn) + '</div>' +
          '<div class="cloud-user-email">' + u.esc(em) + '</div>' +
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
          render(root3);
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
            SL.supabase.signOut().then(function () {
              draw();
              render(root3);
            });
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
              render(root3);
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

    /* ---------- Vault Lock card helper ---------- */
    function renderVaultChange(vCard, root3) {
      vCard.innerHTML =
        '<div class="field" style="margin-bottom:10px"><label for="pv-hint">' + u.esc(t('p.vaultHintLabel')) + '</label>' +
        '<input class="input" id="pv-hint" dir="auto" placeholder="' + u.esc(t('p.vaultHintPh')) + '">' +
        '<span class="field-error" role="alert" data-host="verr" hidden></span></div>' +
        '<button type="button" class="btn btn-ghost" data-act="vcontinue">' + icon('check', 16) + u.esc(t('p.vaultContinue')) + '</button>';
      var hintInput = vCard.querySelector('#pv-hint');
      var verr = vCard.querySelector('[data-host="verr"]');
      vCard.querySelector('[data-act="vcontinue"]').addEventListener('click', function () {
        if (hintInput.value.trim() !== SL.store.vaultHint()) {
          verr.textContent = t('p.vaultHintWrong');
          verr.hidden = false;
          return;
        }
        renderNewPin(vCard, root3);
      });
      hintInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') vCard.querySelector('[data-act="vcontinue"]').click();
      });
    }

    function renderNewPin(vCard, root3) {
      vCard.innerHTML =
        '<div class="field" style="margin-bottom:10px"><label for="pv-pin1">' + u.esc(t('p.vaultNewPin')) + '</label>' +
        '<input class="input" id="pv-pin1" type="password" inputmode="numeric" maxlength="4" dir="ltr"></div>' +
        '<div class="field" style="margin-bottom:10px"><label for="pv-pin2">' + u.esc(t('p.vaultNewPinConfirm')) + '</label>' +
        '<input class="input" id="pv-pin2" type="password" inputmode="numeric" maxlength="4" dir="ltr">' +
        '<span class="field-error" role="alert" data-host="perr" hidden></span></div>' +
        '<button type="button" class="btn btn-primary" data-act="vsave">' + icon('check', 16) + u.esc(t('p.vaultSave')) + '</button>';
      var perr = vCard.querySelector('[data-host="perr"]');
      vCard.querySelector('[data-act="vsave"]').addEventListener('click', function () {
        var p1 = vCard.querySelector('#pv-pin1').value;
        var p2 = vCard.querySelector('#pv-pin2').value;
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
          if (!res.ok) {
            perr.textContent = t('p.vaultHintWrong');
            perr.hidden = false;
            return;
          }
          SL.ui.toast(t('p.vaultChanged'));
          render(root3);
        });
      });
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

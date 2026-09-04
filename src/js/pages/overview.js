/* ============================================================
   Study Live — pages/overview.js  (V4, Redesigned Home Experience)
   Greeting Hero banner + Quick Action Hub + 4-KPI stat cards +
   Today's schedule & checklist + Semester subjects + Upcoming week.
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

  function greetingKey() {
    var h = new Date().getHours();
    if (h < 12) return 'ov.gMorning';
    if (h < 18) return 'ov.gAfternoon';
    return 'ov.gEvening';
  }

  function statCard(go, iconName, value, labelKey, pillClass) {
    return (
      '<button type="button" class="home-kpi-card" data-go="' + go + '">' +
      '<div class="kpi-card-top">' +
      '<span class="kpi-icon-pill ' + pillClass + '">' + icon(iconName, 17) + '</span>' +
      '<span class="kpi-arrow">' + icon('chevR', 14) + '</span>' +
      '</div>' +
      '<div class="kpi-num num">' + value + '</div>' +
      '<div class="kpi-lbl">' + u.esc(t(labelKey)) + '</div>' +
      '</button>'
    );
  }

  function calculateStreak(today) {
    var streak = 0;
    var dStr = u.addDays(today, -1);
    for (var count = 0; count < 365; count++) {
      var dTasks = SL.store.tasksOn(dStr);
      if (dTasks.length === 0) break;
      var allDone = true;
      for (var i = 0; i < dTasks.length; i++) {
        if (!dTasks[i].done) {
          allDone = false;
          break;
        }
      }
      if (allDone) {
        streak++;
        dStr = u.addDays(dStr, -1);
      } else {
        break;
      }
    }
    var tasksToday = SL.store.tasksOn(today);
    var doneToday = tasksToday.filter(function (x) { return x.done; }).length;
    if (tasksToday.length > 0 && doneToday === tasksToday.length) {
      streak++;
    }
    return streak;
  }

  function render(root2, animate) {
    var st = SL.store.get();
    var today = u.todayStr();
    var parts = SL.pages.tasks.partition();
    var tasksToday = SL.store.tasksOn(today);
    var doneToday = tasksToday.filter(function (x) {
      return x.done;
    }).length;
    var cur = SL.store.currentSemester();
    var weekEnd = u.addDays(today, 7);
    var weekTasks = parts.upcoming
      .filter(function (x) {
        return x.date && x.date <= weekEnd;
      })
      .slice(0, 6);

    var streak = calculateStreak(today);

    // Progress Ring for Today
    var pct = tasksToday.length > 0 ? Math.round((doneToday / tasksToday.length) * 100) : 0;
    var motivKey = 'mo.noTasks';
    if (tasksToday.length > 0) {
      if (pct === 100) motivKey = 'mo.allDone';
      else if (pct >= 50) motivKey = 'mo.keepGoing';
      else if (pct > 0) motivKey = 'mo.great';
      else motivKey = 'mo.start';
    }

    var ringCirc = 2 * Math.PI * 22; // 138.23
    var offset = ringCirc - (pct / 100) * ringCirc;

    var progressRingHTML = tasksToday.length > 0
      ? '<div class="home-progress-wrap">' +
        '<div class="home-ring-box">' +
        '<svg width="56" height="56" viewBox="0 0 56 56">' +
        '<circle cx="28" cy="28" r="22" class="ring-bg"></circle>' +
        '<circle cx="28" cy="28" r="22" class="ring-fill" stroke-dasharray="' + ringCirc + '" stroke-dashoffset="' + offset + '"></circle>' +
        '</svg>' +
        '<div class="home-ring-val num">' + pct + '%</div>' +
        '</div>' +
        '<div class="home-ring-meta">' +
        '<b class="num">' + doneToday + ' / ' + tasksToday.length + '</b>' +
        '<span>' + u.esc(t('sh.done')) + '</span>' +
        '</div>' +
        '</div>'
      : '';

    var studentSpecialty = (st.profile && st.profile.specialty) ? st.profile.specialty : '';

    var html = '';

    /* 1. Hero Card */
    html +=
      '<div class="home-hero-card' + (animate === false ? '' : ' stagger') + '">' +
      '<div class="hero-top-row">' +
      '<div class="hero-text">' +
      '<div class="hero-badge-row">' +
      '<span class="hero-date-badge">' + icon('calendar', 14) + '<span>' + u.esc(u.fmtDateLong(today, SL.i18n.lang)) + '</span></span>' +
      (streak > 0
        ? '<span class="hero-streak-badge">🔥 <b class="num">' + streak + '</b> ' + u.esc(t('str.label')) + '</span>'
        : '') +
      '</div>' +
      '<h1 class="hero-title">' + u.esc(t(greetingKey())) + (studentSpecialty ? ' · ' + u.esc(studentSpecialty) : '') + ' 👋</h1>' +
      '<p class="hero-motiv-msg">' + icon('star', 15) + '<span>' + u.esc(t(motivKey)) + '</span></p>' +
      '</div>' +
      progressRingHTML +
      '</div>' +
      /* Quick Actions */
      '<div class="hero-actions-bar">' +
      '<button type="button" class="btn btn-primary hero-act-btn" data-action="add-task">' + icon('plus', 16) + '<span>' + u.esc(t('ov.addTask')) + '</span></button>' +
      '<button type="button" class="btn btn-ghost hero-act-btn" data-action="new-note">' + icon('notes', 16) + '<span>' + u.esc(t('ov.newNote')) + '</span></button>' +
      '<button type="button" class="btn btn-ghost hero-act-btn" data-action="focus-timer">' + icon('timer', 16) + '<span>' + u.esc(t('ov.focusTimer')) + '</span></button>' +
      '<button type="button" class="btn btn-ghost hero-act-btn" data-go="stats">' + icon('chart', 16) + '<span>' + u.esc(t('nav.stats')) + '</span></button>' +
      '</div>' +
      '</div>';

    /* 2. 4-KPI Metric Cards Grid */
    html +=
      '<div class="home-stats-grid' + (animate === false ? '' : ' stagger') + '">' +
      statCard('tasks', 'tasks', tasksToday.length, 'ov.statsToday', 'pill-blue') +
      statCard('tasks', 'check', doneToday, 'ov.statsDone', 'pill-green') +
      statCard('tasks', 'clock', parts.backlog.length, 'ov.statsBacklog', parts.backlog.length ? 'pill-rose' : 'pill-gray') +
      statCard('notes', 'notes', st.notes.length, 'ov.statsNotes', 'pill-purple') +
      '</div>';

    /* 3. Today's Focus Section */
    html += '<h2 class="section-title">' + icon('check', 16) + u.esc(t('ov.todayFocus')) + '</h2>';
    if (tasksToday.length > 0) {
      html +=
        '<div class="card card-pad home-today-card">' +
        '<div class="home-tasks-list">' +
        tasksToday
          .map(function (task) {
            var sub = task.subjectId ? SL.store.subjectById(task.subjectId) : null;
            return (
              '<div class="home-task-row' + (task.done ? ' is-done' : '') + '" data-id="' + task.id + '">' +
              '<button type="button" class="home-check-btn' + (task.done ? ' checked' : '') + '" data-act="toggle-task" aria-label="Toggle task">' +
              (task.done ? icon('check', 14) : '') +
              '</button>' +
              '<div class="home-task-main" data-act="edit-task">' +
              '<div class="home-task-title' + (task.done ? ' done-strike' : '') + '">' + u.esc(task.title) + '</div>' +
              '<div class="home-task-sub">' +
              (sub ? '<span class="task-chip-sub"><i style="background:' + u.esc(sub.color) + '"></i>' + u.esc(sub.name) + '</span>' : '') +
              (task.difficulty ? '<span class="badge badge-' + task.difficulty + '">' + u.esc(t('t.diff' + (task.difficulty === 'hard' ? 'Hard' : task.difficulty === 'easy' ? 'Easy' : 'Light'))) + '</span>' : '') +
              '</div>' +
              '</div>' +
              '</div>'
            );
          })
          .join('') +
        '</div>' +
        '</div>';
    } else {
      html +=
        '<div class="card card-pad home-empty-today">' +
        '<span class="empty-star-pill">✨</span>' +
        '<div class="empty-today-text">' +
        '<div class="empty-today-title">' + u.esc(t('ov.noTasksToday')) + '</div>' +
        '</div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="add-task">' + icon('plus', 14) + '<span>' + u.esc(t('ov.addTask')) + '</span></button>' +
        '</div>';
    }

    /* 4. Academic Position */
    html += '<h2 class="section-title">' + icon('graduation', 16) + u.esc(t('p.position')) + '</h2>';
    html += '<div class="card card-pad academic-pos-card">';
    if (cur) {
      var semSubjects = SL.store.subjectsOf(cur.sem.id);
      html +=
        '<div class="pos-top-bar">' +
        '<span class="pos-badge">' + icon('bookmark', 16) + '<span>' +
        u.esc(t('p.now', {
          year: SL.i18n.yearName(cur.yearIndex + 1),
          sem: SL.i18n.semName(cur.semIndex + 1),
        })) + '</span></span>' +
        '<span class="day-count">' + u.esc(t('p.subjectsCount', { n: semSubjects.length })) + '</span>' +
        '</div>';

      if (semSubjects.length > 0) {
        html +=
          '<div class="home-sub-chips">' +
          semSubjects
            .map(function (s) {
              return (
                '<span class="home-sub-chip">' +
                '<i style="background:' + u.esc(s.color) + '"></i>' +
                '<span>' + u.esc(s.name) + '</span>' +
                '</span>'
              );
            })
            .join('') +
          '</div>';
      }
    } else {
      html +=
        '<div class="g-empty-line">' + u.esc(t('s.noCurrent')) + '</div>' +
        '<button class="btn btn-ghost" data-go="profile" style="margin-top:8px">' + icon('chevR', 16) + u.esc(t('s.goProfile')) + '</button>';
    }
    html += '</div>';

    /* 5. Upcoming Week Section */
    html += '<h2 class="section-title">' + icon('calendar', 14) + u.esc(t('ov.week')) + '</h2>';
    if (weekTasks.length > 0) {
      html +=
        '<div class="card card-pad' + (animate === false ? '' : ' stagger') + '">' +
        weekTasks
          .map(function (x) {
            var s = x.subjectId ? SL.store.subjectById(x.subjectId) : null;
            return (
              '<div class="sem-row" style="padding:10px 2px">' +
              '<span class="chip-date' + (u.isPast(x.date) ? ' late' : '') + '">' + u.esc(x.date ? u.fmtDateShort(x.date, SL.i18n.lang) : t('t.openDate')) + '</span>' +
              '<span class="s-title" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + u.esc(x.title) + '</span>' +
              '<span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + (s ? u.esc(s.color) : 'var(--none-subject)') + ';flex-shrink:0"></span>' +
              '</div>'
            );
          })
          .join('') +
        '</div>';
    } else {
      html +=
        '<div class="card card-pad home-week-empty-card">' +
        '<span class="week-empty-icon">' + icon('calendar', 26) + '</span>' +
        '<div class="week-empty-title">' + u.esc(t('ov.weekEmpty')) + '</div>' +
        '<div class="week-empty-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-action="add-task">' + icon('plus', 14) + '<span>' + u.esc(t('ov.addTask')) + '</span></button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-go="tasks">' + icon('tasks', 14) + '<span>' + u.esc(t('nav.tasks')) + '</span></button>' +
        '</div>' +
        '</div>';
    }

    root2.innerHTML = '<div class="home-page-container">' + html + '</div>';

    /* Event Delegation */
    if (root2._onClick) root2.removeEventListener('click', root2._onClick);
    root2._onClick = function (e) {
      var act = e.target.closest('[data-action]');
      if (act) {
        var action = act.getAttribute('data-action');
        if (action === 'add-task') {
          SL.ui.openTaskForm({ date: today });
          return;
        }
        if (action === 'new-note') {
          SL.ui.openNoteForm({});
          return;
        }
        if (action === 'focus-timer') {
          SL.ui.openPomodoroModal();
          return;
        }
      }

      var toggleBtn = e.target.closest('[data-act="toggle-task"]');
      if (toggleBtn) {
        var row = toggleBtn.closest('[data-id]');
        if (row) {
          var id = row.getAttribute('data-id');
          SL.store.toggleTask(id);
          render(root2, false);
          return;
        }
      }

      var editBtn = e.target.closest('[data-act="edit-task"]');
      if (editBtn) {
        var r = editBtn.closest('[data-id]');
        if (r) {
          var tid = r.getAttribute('data-id');
          var taskObj = SL.store.get().tasks.filter(function (x) { return x.id === tid; })[0];
          if (taskObj) SL.ui.openTaskForm({ task: taskObj });
          return;
        }
      }

      var go = e.target.closest('[data-go]');
      if (go) {
        SL.router.go(go.getAttribute('data-go'));
      }
    };
    root2.addEventListener('click', root2._onClick);
  }

  SL.pages = SL.pages || {};
  SL.pages.overview = {
    id: 'overview',
    labelKey: 'nav.overview',
    icon: 'logo',
    render: render,
  };
})(typeof window !== 'undefined' ? window : globalThis);

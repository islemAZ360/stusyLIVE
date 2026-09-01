/* ============================================================
   Study Live — pages/overview.js  (V3, home page)
   Greeting + study stats + current semester + this-week list.
   Pure read-only aggregation over the store.
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

  function statCard(go, iconName, value, labelKey, tone) {
    return (
      '<button type="button" class="stat-card' + (tone ? ' ' + tone : '') + '" data-go="' + go + '">' +
      icon(iconName, 19) +
      '<span class="stat-v">' + value + '</span>' +
      '<span class="stat-l">' + u.esc(t(labelKey)) + '</span>' +
      '</button>'
    );
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
        return x.date <= weekEnd;
      })
      .slice(0, 5);

    // Calculate streak
    var streak = 0;
    var dStr = u.addDays(today, -1);
    while (true) {
      var dTasks = SL.store.tasksOn(dStr);
      if (dTasks.length === 0) break; // no tasks = no streak continuation
      var allDone = true;
      for (var i = 0; i < dTasks.length; i++) {
        if (!dTasks[i].done) { allDone = false; break; }
      }
      if (allDone) { streak++; dStr = u.addDays(dStr, -1); }
      else break;
    }
    // Also add today if today's tasks are all done and > 0
    if (tasksToday.length > 0 && doneToday === tasksToday.length) {
      streak++;
    }

    var progressHtml = '';
    var motivKey = 'mo.noTasks';
    if (tasksToday.length > 0) {
      var pct = Math.round((doneToday / tasksToday.length) * 100);
      var ringCirc = 2 * Math.PI * 18;
      var offset = ringCirc - (pct / 100) * ringCirc;
      
      progressHtml = 
        '<div class="progress-ring" style="width:44px;height:44px;flex-shrink:0">' +
          '<svg width="44" height="44" viewBox="0 0 44 44" fill="none">' +
            '<circle cx="22" cy="22" r="18" stroke-width="4" class="ring-bg"></circle>' +
            '<circle cx="22" cy="22" r="18" stroke-width="4" class="ring-fill" ' +
              'stroke-dasharray="' + ringCirc + '" stroke-dashoffset="' + offset + '"></circle>' +
          '</svg>' +
          '<div class="ring-label" style="color:var(' + (pct === 100 ? '--success' : '--ink') + ')">' + pct + '</div>' +
        '</div>';

      if (pct === 100) motivKey = 'mo.allDone';
      else if (pct >= 50) motivKey = 'mo.keepGoing';
      else if (pct > 0) motivKey = 'mo.great';
      else motivKey = 'mo.start';
    }

    var streakHtml = streak >= 2 
      ? '<div class="streak-wrap"><span class="streak-fire">🔥</span><span class="streak-num">' + streak + '</span> ' + u.esc(t('str.label')) + '</div>'
      : '';

    root2.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<div>' +
          '<h1 class="page-title" style="margin-bottom:6px">' + u.esc(t(greetingKey())) + '</h1>' +
          '<p class="day-greeting">' + icon('calendar', 15) + '<span>' +
          u.esc(u.fmtDateLong(today, SL.i18n.lang)) + '</span></p>' +
        '</div>' +
        progressHtml +
      '</div>' +

      '<div class="motiv-badge" style="margin-bottom:16px;background:var(--gradient-accent-soft);color:var(--accent);border-color:color-mix(in srgb, var(--accent) 15%, var(--border))">' + 
        icon('star', 15) + '<span>' + u.esc(t(motivKey)) + '</span>' + 
      '</div>' + 
      (streakHtml ? '<div style="margin-bottom:16px">' + streakHtml + '</div>' : '') +

      '<div class="stats-grid stagger">' +
      statCard('tasks', 'tasks', tasksToday.length, 'ov.statsToday', '') +
      statCard('tasks', 'check', doneToday, 'ov.statsDone', 'tone-ok') +
      statCard('tasks', 'clock', parts.backlog.length, 'ov.statsBacklog', parts.backlog.length ? 'tone-late' : '') +
      statCard('notes', 'notes', st.notes.length, 'ov.statsNotes', '') +
      '</div>' +

      '<h2 class="section-title">' + icon('graduation', 16) + u.esc(t('p.position')) + '</h2>' +
      '<div class="card card-pad">' +
      (cur
        ? '<div class="pos-now"><span class="pos-badge">' + icon('bookmark', 16) + '<span>' +
          u.esc(t('p.now', {
            year: SL.i18n.yearName(cur.yearIndex + 1),
            sem: SL.i18n.semName(cur.semIndex + 1),
          })) + '</span></span>' +
          '<span class="day-count">' + u.esc(t('p.subjectsCount', { n: SL.store.subjectsOf(cur.sem.id).length })) + '</span></div>'
        : '<div class="g-empty-line">' + u.esc(t('s.noCurrent')) + '</div>' +
          '<button class="btn btn-ghost" data-go="profile" style="margin-top:8px">' + icon('chevR', 16) + u.esc(t('s.goProfile')) + '</button>') +
      '</div>' +

      '<h2 class="section-title">' + icon('calendar', 14) + u.esc(t('ov.week')) + '</h2>' +
      '<div data-host="week"></div>';

    var weekHost = root2.querySelector('[data-host="week"]');
    if (!weekTasks.length) {
      weekHost.innerHTML =
        '<div class="empty" style="padding:22px 16px">' + icon('tasks', 34) +
        '<div class="e-title">' + u.esc(t('ov.weekEmpty')) + '</div>' +
        '<div class="e-hint">' + u.esc(t('t.emptyDayHint')) + '</div></div>';
    } else {
      var wrap = document.createElement('div');
      wrap.className = 'card card-pad' + (animate === false ? '' : ' stagger');
      wrap.innerHTML = weekTasks
        .map(function (x) {
          var s = x.subjectId ? SL.store.subjectById(x.subjectId) : null;
          return (
            '<div class="sem-row" style="padding:9px 2px">' +
            '<span class="chip-date' + (u.isPast(x.date) ? ' late' : '') + '">' + u.esc(u.fmtDateShort(x.date, SL.i18n.lang)) + '</span>' +
            '<span class="s-title" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + u.esc(x.title) + '</span>' +
            '<span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + (s ? u.esc(s.color) : 'var(--none-subject)') + ';flex-shrink:0"></span>' +
            '</div>'
          );
        })
        .join('');
      weekHost.appendChild(wrap);
    }

    if (root2._onClick) root2.removeEventListener('click', root2._onClick);
    root2._onClick = function (e) {
      var go = e.target.closest('[data-go]');
      if (go) SL.router.go(go.getAttribute('data-go'));
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

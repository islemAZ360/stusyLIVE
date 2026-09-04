/* ============================================================
   Study Live — pages/stats.js  (V5 - Smart Analytics & AI Coach)
   Statistics: smart KPI grid, AI coaching & insights, completion
   donut, workload breakdown, busiest days, subject rankings,
   standing sliders & sparkline historical trends.
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

  /* ---------- streak calculation ---------- */

  function calculateStreak() {
    var today = u.todayStr();
    var tasksToday = SL.store.tasksOn(today);
    var doneToday = tasksToday.filter(function (tk) {
      return tk.done;
    }).length;
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
    if (tasksToday.length > 0 && doneToday === tasksToday.length) {
      streak++;
    }
    return streak;
  }

  /* ---------- aggregation ---------- */

  function aggregates() {
    var st = SL.store.get();
    var today = u.todayStr();
    var done = 0;
    var notDone = 0;
    var openDateCount = 0;
    var datedCount = 0;
    var overdueCount = 0;
    var byDay = {};
    var bySub = {};
    var missedBySub = {};
    var byDifficulty = { light: 0, easy: 0, hard: 0 };

    st.tasks.forEach(function (task) {
      if (task.done) {
        done++;
      } else {
        notDone++;
        var diff = task.difficulty === 'hard' ? 'hard' : task.difficulty === 'easy' ? 'easy' : 'light';
        byDifficulty[diff] = (byDifficulty[diff] || 0) + 1;
        if (!task.date) {
          openDateCount++;
        } else {
          datedCount++;
          if (task.date < today) {
            overdueCount++;
          }
        }
      }
      if (task.date) byDay[task.date] = (byDay[task.date] || 0) + 1;
      if (task.subjectId) {
        bySub[task.subjectId] = (bySub[task.subjectId] || 0) + 1;
        if (!task.done && task.date && task.date < today) {
          missedBySub[task.subjectId] = (missedBySub[task.subjectId] || 0) + 1;
        }
      }
    });

    var streak = calculateStreak();

    var masteryPct = null;
    var hardestSubject = null;
    if (st.subjects.length > 0) {
      var totalStanding = 0;
      var sortedSubs = st.subjects.slice().sort(function (a, b) {
        var ca = a.standing == null ? 50 : a.standing;
        var cb = b.standing == null ? 50 : b.standing;
        return ca - cb;
      });
      st.subjects.forEach(function (s) {
        totalStanding += s.standing == null ? 50 : s.standing;
      });
      masteryPct = Math.round(totalStanding / st.subjects.length);
      var lowestVal = sortedSubs[0].standing == null ? 50 : sortedSubs[0].standing;
      if (lowestVal < 65) {
        hardestSubject = { subject: sortedSubs[0], val: lowestVal };
      }
    }

    return {
      total: st.tasks.length,
      done: done,
      notDone: notDone,
      openDateCount: openDateCount,
      datedCount: datedCount,
      overdueCount: overdueCount,
      byDay: byDay,
      bySub: bySub,
      missedBySub: missedBySub,
      byDifficulty: byDifficulty,
      streak: streak,
      masteryPct: masteryPct,
      hardestSubject: hardestSubject,
    };
  }

  function topEntries(map, limit) {
    return Object.keys(map)
      .map(function (key) {
        return { key: key, count: map[key] };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      })
      .slice(0, limit || 5);
  }

  function valueTone(v) {
    return v < 35 ? 'bad' : v > 65 ? 'good' : 'mid';
  }

  function standingColor(v) {
    return 'color-mix(in srgb, var(--success) ' + v + '%, var(--danger))';
  }

  /* ---------- fragments ---------- */

  function kpiCardsHTML(agg) {
    var pct = agg.total ? Math.round((agg.done / agg.total) * 100) : 0;
    var streakVal = agg.streak > 0 ? t('sh.streakDays', { n: agg.streak }) : t('sh.streakZero');
    var masteryVal = agg.masteryPct != null ? agg.masteryPct + '%' : '—';
    var masteryTone = agg.masteryPct != null ? valueTone(agg.masteryPct) : 'mid';

    return (
      '<div class="stats-kpi-grid">' +
      /* 1: Completion Rate */
      '<div class="stats-kpi-card">' +
      '<div class="kpi-top"><span class="kpi-label">' + u.esc(t('sh.ratio')) + '</span><span class="kpi-icon-pill p-blue">' + icon('check', 14) + '</span></div>' +
      '<div class="kpi-value num">' + pct + '%</div>' +
      '<div class="kpi-sub">' + u.esc(t('sh.summary', { done: agg.done, total: agg.total })) + '</div>' +
      '</div>' +
      /* 2: Streak */
      '<div class="stats-kpi-card">' +
      '<div class="kpi-top"><span class="kpi-label">' + u.esc(t('sh.streak')) + '</span><span class="kpi-icon-pill p-fire">🔥</span></div>' +
      '<div class="kpi-value kpi-streak">' + u.esc(streakVal) + '</div>' +
      '<div class="kpi-sub">' + (agg.streak > 0 ? '⚡ ' + u.esc(t('sh.streak')) : '🎯 ' + u.esc(t('sh.streakZero'))) + '</div>' +
      '</div>' +
      /* 3: Active Workload */
      '<div class="stats-kpi-card">' +
      '<div class="kpi-top"><span class="kpi-label">' + u.esc(t('sh.activeTasks')) + '</span><span class="kpi-icon-pill p-purple">' + icon('tasks', 14) + '</span></div>' +
      '<div class="kpi-value num">' + agg.notDone + '</div>' +
      '<div class="kpi-sub">' + u.esc(t('sh.openDateCount', { n: agg.openDateCount })) + ' · ' + u.esc(t('sh.datedCount', { n: agg.datedCount })) + '</div>' +
      '</div>' +
      /* 4: Academic Mastery */
      '<div class="stats-kpi-card">' +
      '<div class="kpi-top"><span class="kpi-label">' + u.esc(t('sh.academicMastery')) + '</span><span class="kpi-icon-pill p-gold">' + icon('bookmark', 14) + '</span></div>' +
      '<div class="kpi-value num standing-' + masteryTone + '">' + masteryVal + '</div>' +
      '<div class="kpi-sub">' + (agg.masteryPct != null ? u.esc(t('sh.standing')) : u.esc(t('sh.noSubjects'))) + '</div>' +
      '</div>' +
      '</div>'
    );
  }

  function smartInsightsHTML(agg) {
    var tips = [];

    if (agg.overdueCount > 0) {
      tips.push({
        type: 'alert',
        icon: '⚠️',
        text: t('sh.recOverdue', { n: agg.overdueCount }),
      });
    }

    if (agg.hardestSubject) {
      tips.push({
        type: 'challenge',
        icon: '🎯',
        text: t('sh.recChallenge', {
          subject: agg.hardestSubject.subject.name,
          val: agg.hardestSubject.val,
        }),
      });
    }

    if (agg.openDateCount > 0) {
      tips.push({
        type: 'info',
        icon: '📅',
        text: t('sh.recOpenDate', { n: agg.openDateCount }),
      });
    }

    if (agg.streak === 0 && agg.notDone > 0) {
      tips.push({
        type: 'boost',
        icon: '⚡',
        text: t('sh.recStreak'),
      });
    }

    if (agg.total > 0 && agg.notDone === 0) {
      tips.push({
        type: 'celebrate',
        icon: '🌟',
        text: t('sh.recAllDone'),
      });
    }

    if (!tips.length) return '';

    return (
      '<div class="card card-pad stats-insight-card">' +
      '<div class="insight-head">' +
      '<span class="insight-glow-icon">' + icon('lightbulb', 18) + '</span>' +
      '<h3 class="insight-title">' + u.esc(t('sh.smartInsights')) + '</h3>' +
      '</div>' +
      '<ul class="insight-list">' +
      tips
        .map(function (tip) {
          return (
            '<li class="insight-item insight-' + tip.type + '">' +
            '<span class="insight-item-icon">' + tip.icon + '</span>' +
            '<span class="insight-item-text">' + u.esc(tip.text) + '</span>' +
            '</li>'
          );
        })
        .join('') +
      '</ul>' +
      '</div>'
    );
  }

  function ratioHTML(done, notDone) {
    var total = done + notDone;
    var pct = total ? Math.round((done / total) * 100) : 0;
    var deg = Math.round((pct / 100) * 360);
    return (
      '<div class="ratio-wrap">' +
      '<div class="donut" style="--deg:' + deg + 'deg" role="img" aria-label="' + u.esc(t('sh.ratio')) + ' ' + pct + '%">' +
      '<div class="donut-hole"><span class="donut-num">' + pct + '%</span><span class="donut-cap">' + u.esc(t('sh.done')) + '</span></div>' +
      '</div>' +
      '<div class="ratio-legend">' +
      '<div class="legend-row"><span class="legend-dot" style="background:var(--success)"></span>' +
      '<span>' + u.esc(t('sh.done')) + '</span><b class="num">' + done + '</b></div>' +
      '<div class="legend-row"><span class="legend-dot" style="background:var(--danger)"></span>' +
      '<span>' + u.esc(t('sh.notDone')) + '</span><b class="num">' + notDone + '</b></div>' +
      '<div class="legend-row legend-total"><span class="legend-dot" style="background:var(--accent)"></span>' +
      '<span>' + u.esc(t('sh.total')) + '</span><b class="num">' + total + '</b></div>' +
      '</div></div>'
    );
  }

  function workloadHTML(byDiff, notDone) {
    if (!notDone) return '';
    var lPct = Math.round((byDiff.light / notDone) * 100);
    var ePct = Math.round((byDiff.easy / notDone) * 100);
    var hPct = Math.max(0, 100 - lPct - ePct);

    return (
      '<div class="workload-breakdown">' +
      '<div class="workload-bar">' +
      (byDiff.light > 0 ? '<div class="wb-segment wb-light" style="width:' + lPct + '%" title="' + u.esc(t('t.diffLight')) + ': ' + byDiff.light + '"></div>' : '') +
      (byDiff.easy > 0 ? '<div class="wb-segment wb-easy" style="width:' + ePct + '%" title="' + u.esc(t('t.diffEasy')) + ': ' + byDiff.easy + '"></div>' : '') +
      (byDiff.hard > 0 ? '<div class="wb-segment wb-hard" style="width:' + hPct + '%" title="' + u.esc(t('t.diffHard')) + ': ' + byDiff.hard + '"></div>' : '') +
      '</div>' +
      '<div class="workload-chips">' +
      '<span class="wchip wc-light"><i class="wdot"></i>' + u.esc(t('t.diffLight')) + ' <b class="num">' + byDiff.light + '</b></span>' +
      '<span class="wchip wc-easy"><i class="wdot"></i>' + u.esc(t('t.diffEasy')) + ' <b class="num">' + byDiff.easy + '</b></span>' +
      '<span class="wchip wc-hard"><i class="wdot"></i>' + u.esc(t('t.diffHard')) + ' <b class="num">' + byDiff.hard + '</b></span>' +
      '</div>' +
      '</div>'
    );
  }

  function barListHTML(entries, opts) {
    var max = entries.reduce(function (m, e) {
      return Math.max(m, e.count);
    }, 1);
    return (
      '<div class="bar-list' + (animateClass(opts.animate) ? ' stagger' : '') + '">' +
      entries
        .map(function (e) {
          var pct = Math.round((e.count / max) * 100);
          return (
            '<div class="bar-row"><span class="bar-label">' + u.esc(e.label) + '</span>' +
            '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%;background:' + e.color + '"></span></span>' +
            '<b class="bar-val num">' + e.count + '</b></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function animateClass(animate) {
    return animate !== false;
  }

  function sparkline(history) {
    var last = history.slice(-8);
    if (!last.length) return '';
    return (
      '<span class="spark" aria-hidden="true">' +
      last
        .map(function (e) {
          return '<i style="height:' + Math.max(12, e.value) + '%;background:' + standingColor(e.value) + '"></i>';
        })
        .join('') +
      '</span>'
    );
  }

  function hardestRows(st) {
    var seen = {};
    var rows = [];
    st.standingLog.forEach(function (entry) {
      if (seen[entry.subjectId]) return;
      seen[entry.subjectId] = true;
      var s = SL.store.subjectById(entry.subjectId);
      if (!s) return;
      var history = SL.store.standingHistory(entry.subjectId);
      var current = history[history.length - 1];
      var prev = history.length > 1 ? history[history.length - 2] : null;
      var delta = prev ? current.value - prev.value : 0;
      var trendKey = prev ? (delta > 0 ? 'sh.improved' : delta < 0 ? 'sh.declined' : 'sh.unchanged') : 'sh.unchanged';
      var tone = delta > 0 ? 'good' : delta < 0 ? 'bad' : 'mid';
      rows.push({
        subject: s,
        value: current.value,
        history: history,
        trendKey: trendKey,
        tone: tone,
        lastDate: current.date,
      });
    });
    rows.sort(function (a, b) {
      return a.value - b.value;
    });
    if (!rows.length) {
      return '<div class="g-empty-line">' + u.esc(t('sh.noStanding')) + '</div>';
    }
    return rows
      .map(function (r) {
        return (
          '<div class="hardest-row">' +
          '<span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + u.esc(r.subject.color) + ';flex-shrink:0"></span>' +
          '<span class="h-name">' + u.esc(r.subject.name) + '</span>' +
          sparkline(r.history) +
          '<span class="standing-badge ' + valueTone(r.value) + ' num" style="border-color:' + standingColor(r.value) + '">' + r.value + '%</span>' +
          '<span class="trend-badge ' + r.tone + '">' + u.esc(t(r.trendKey)) + '</span>' +
          '<span class="h-date">' + u.esc(t('sh.lastChanged', { date: u.fmtDateShort(r.lastDate, SL.i18n.lang) })) + '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function slidersHTML(st) {
    var subjects = st.subjects.slice().sort(function (a, b) {
      var ca = a.standing == null ? 50 : a.standing;
      var cb = b.standing == null ? 50 : b.standing;
      return ca - cb;
    });
    if (!subjects.length) {
      return '<div class="g-empty-line">' + u.esc(t('sh.noSubjects')) + '</div>';
    }
    return subjects
      .map(function (s) {
        var v = s.standing == null ? 50 : s.standing;
        return (
          '<div class="standing-row" data-sid="' + s.id + '">' +
          '<span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + u.esc(s.color) + ';flex-shrink:0"></span>' +
          '<span class="h-name">' + u.esc(s.name) + '</span>' +
          '<input type="range" min="0" max="100" step="5" value="' + v + '" dir="ltr" ' +
          'aria-label="' + u.esc(s.name) + ' — ' + u.esc(t('sh.standing')) + '">' +
          '<span class="standing-badge num ' + valueTone(v) + '" style="border-color:' + standingColor(v) + '">' + v + '%</span>' +
          '</div>'
        );
      })
      .join('');
  }

  /* ---------- render ---------- */

  function render(root2, animate) {
    var st = SL.store.get();
    var agg = aggregates();
    var subjectsExist = st.subjects.length > 0;
    var hasTasks = agg.total > 0;

    root2.innerHTML =
      '<h1 class="page-title">' + u.esc(t('nav.stats')) + '</h1>' +
      (hasTasks
        ? '<p class="day-greeting"><span>' +
          u.esc(t('sh.summary', { done: agg.done, total: agg.total })) + '</span></p>'
        : '') +
      '<div data-host="body" class="stats-body-wrap"></div>';

    var body = root2.querySelector('[data-host="body"]');
    var bodyIsJustEmpty = !agg.total && !subjectsExist;
    if (bodyIsJustEmpty) {
      body.classList.add('empty-center');
    } else {
      body.classList.remove('empty-center');
    }

    var html = '';

    if (!agg.total) {
      html +=
        '<div class="empty' + (bodyIsJustEmpty ? '' : ' empty-in-flow') + '">' +
        icon('chart', 40) +
        '<div class="e-title">' + u.esc(t('sh.noTasks')) + '</div>' +
        '<div class="e-hint">' + u.esc(t('sh.noTasksHint')) + '</div>' +
        '<button type="button" class="btn btn-primary" data-go="tasks">' +
        icon('tasks', 17) + u.esc(t('nav.tasks')) + '</button>' +
        '</div>';
    } else {
      /* 1: Smart KPI Dashboard */
      html += kpiCardsHTML(agg);

      /* 2: AI Coach & Smart Insights */
      html += smartInsightsHTML(agg);

      /* 3: Completion Rate Card with Motivator */
      var pct = Math.round((agg.done / agg.total) * 100);
      var motivKey = 'mo.statsLow';
      if (pct >= 90) motivKey = 'mo.statsHigh';
      else if (pct >= 50) motivKey = 'mo.statsMid';

      html += '<h2 class="section-title">' + icon('check', 14) + u.esc(t('sh.ratio')) + '</h2>';
      html += '<div class="card card-pad">' + ratioHTML(agg.done, agg.notDone) +
              '<div class="motiv-message">' + u.esc(t(motivKey)) + '</div>' +
              workloadHTML(agg.byDifficulty, agg.notDone) +
              '</div>';

      /* 4: Busiest Days */
      var days = topEntries(agg.byDay, 5).map(function (e) {
        return { label: u.fmtDateShort(e.key, SL.i18n.lang), count: e.count, color: 'var(--accent)' };
      });
      html += '<h2 class="section-title">' + icon('calendar', 14) + u.esc(t('sh.busiestDays')) + '</h2>';
      if (days.length > 0) {
        html += '<div class="card card-pad">' + barListHTML(days, { animate: animate }) + '</div>';
      } else {
        html += '<div class="card card-pad bday-empty-card">' +
          icon('calendar', 22) +
          '<span>' + u.esc(t('sh.noDatedDays')) + '</span>' +
          '</div>';
      }

      /* 5: Top Subjects */
      var topSubs = topEntries(agg.bySub, 5).map(function (e) {
        var s = SL.store.subjectById(e.key);
        return { label: s ? s.name : t('t.noSubject'), count: e.count, color: s ? s.color : 'var(--none-subject)' };
      });
      if (topSubs.length) {
        html += '<h2 class="section-title">' + icon('tag', 14) + u.esc(t('sh.topSubjects')) + '</h2>';
        html += '<div class="card card-pad">' + barListHTML(topSubs, { animate: animate }) + '</div>';
      }

      /* 6: Most Missed (Overdue) */
      var missed = topEntries(agg.missedBySub, 5).map(function (e) {
        var s = SL.store.subjectById(e.key);
        return { label: s ? s.name : t('t.noSubject'), count: e.count, color: 'var(--danger)' };
      });
      if (missed.length) {
        html += '<h2 class="section-title">' + icon('clock', 14) + u.esc(t('sh.mostMissed')) + '</h2>';
        html += '<div class="card card-pad">' + barListHTML(missed, { animate: animate }) + '</div>';
      }
    }

    /* 7: Subject Standing & Trends */
    if (subjectsExist) {
      html += '<h2 class="section-title">' + icon('bookmark', 14) + u.esc(t('sh.standing')) + '</h2>';
      html +=
        '<div class="card card-pad"><p class="hint-line" style="margin-bottom:12px">' + u.esc(t('sh.standingHint')) + '</p>' +
        '<div class="standing-ends"><span class="se bad">' + u.esc(t('sh.hard')) + '</span>' +
        '<span class="se good">' + u.esc(t('sh.good')) + '</span></div>' +
        '<div data-host="sliders">' + slidersHTML(st) + '</div></div>';

      html += '<h2 class="section-title">' + icon('alert', 14) + u.esc(t('sh.hardest')) + '</h2>';
      html += '<div class="card card-pad" data-host="hardest">' + hardestRows(st) + '</div>';
    }

    body.innerHTML = html;

    /* Slider interactive binding */
    u.$$('.standing-row', body).forEach(function (row) {
      var sid = row.getAttribute('data-sid');
      var input = row.querySelector('input[type="range"]');
      var badge = row.querySelector('.standing-badge');
      input.addEventListener('input', function () {
        var v = parseInt(input.value, 10);
        badge.textContent = v + '%';
        badge.className = 'standing-badge num ' + valueTone(v);
        badge.style.borderColor = standingColor(v);
      });
      input.addEventListener('change', function () {
        SL.store.setStanding(sid, parseInt(input.value, 10));
        render(root2, false);
      });
    });

    if (animate === false) {
      u.$$('.stagger', body).forEach(function (el) {
        el.classList.remove('stagger');
      });
    }

    if (root2._onClick) root2.removeEventListener('click', root2._onClick);
    root2._onClick = function (e) {
      var go = e.target.closest('[data-go]');
      if (go) SL.router.go(go.getAttribute('data-go'));
    };
    root2.addEventListener('click', root2._onClick);
  }

  SL.pages = SL.pages || {};
  SL.pages.stats = {
    id: 'stats',
    labelKey: 'nav.stats',
    icon: 'chart',
    render: render,
  };
})(typeof window !== 'undefined' ? window : globalThis);


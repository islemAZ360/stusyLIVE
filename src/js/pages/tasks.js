/* ============================================================
   Study Live — pages/tasks.js  (V4.3)
   Calendar + two views, responsive:
   - Desktop/tablet (≥768px): month calendar + grouped list.
   - Phone (<768px): vertical agenda feed (day headers + tasks),
     like the reference screenshots; the month grid is hidden.
   Any task can be toggled done, edited or deleted anywhere;
   new tasks accept past dates.
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var u = SL.utils;
  var t = function (k, v) {
    return SL.i18n.t(k, v);
  };

  var view = { year: null, month: null, selected: null, mode: 'all' };
  var lastSlide = null; // 'fwd' | 'back' — consumed by next calendar render

  function init() {
    var now = new Date();
    view.year = now.getFullYear();
    view.month = now.getMonth();
    view.selected = u.todayStr();
  }

  function subjectOf(task) {
    return task.subjectId ? SL.store.subjectById(task.subjectId) : null;
  }

  function dotsFor(ymd) {
    return SL.store.tasksOn(ymd).map(function (task) {
      var s = subjectOf(task);
      return { color: s ? s.color : 'var(--none-subject)', done: task.done };
    });
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function icon(name, size) {
    return SL.ui.icon(name, size);
  }

  /* progress fill color: red → blue → green */
  function progressFill(p) {
    return p <= 50 ? u.mix('#e5484d', '#3a6edc', p / 50) : u.mix('#3a6edc', '#46a758', (p - 50) / 50);
  }

  function progressBackground(p) {
    return 'linear-gradient(to right, ' + progressFill(p) + ' 0 ' + p + '%, var(--surface-2) ' + p + '% 100%)';
  }

  function byDateAsc(a, b) {
    if (!a.date && b.date) return 1;
    if (a.date && !b.date) return -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0);
  }

  function byDateDesc(a, b) {
    if (!a.date && b.date) return 1;
    if (a.date && !b.date) return -1;
    return a.date > b.date ? -1 : a.date < b.date ? 1 : (b.createdAt || 0) - (a.createdAt || 0);
  }

  function partition() {
    var st = SL.store.get();
    var today = u.todayStr();
    var backlog = [];
    var upcoming = [];
    var done = [];
    st.tasks.forEach(function (task) {
      if (task.done) done.push(task);
      else if (task.date && task.date < today) backlog.push(task);
      else upcoming.push(task);
    });
    backlog.sort(byDateAsc);
    upcoming.sort(byDateAsc);
    done.sort(byDateDesc);
    return { backlog: backlog, upcoming: upcoming, done: done, total: st.tasks.length };
  }

  function taskRowHTML(task, showDate) {
    var s = subjectOf(task);
    var late = !task.done && task.date && u.isPast(task.date);
    return (
      '<div class="card task-card task-row' + (task.done ? ' done' : '') + (late ? ' is-late' : '') +
      '" data-id="' + task.id + '">' +
      '<button class="check" data-act="toggle" role="checkbox" aria-checked="' + (task.done ? 'true' : 'false') +
      '" aria-label="' + u.esc(t('a.done')) + '">' +
      '<svg viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 10.5l4 4 8-8.5"/></svg></button>' +
      '<div class="t-body"><div class="t-title">' + u.esc(task.title) + '</div>' +
      (task.description ? '<div class="t-desc">' + u.esc(task.description) + '</div>' : '') +
      (task.progressEnabled
        ? '<div class="task-progress" data-pwrap="' + task.id + '">' +
          '<input type="range" min="0" max="100" step="1" value="' + (task.progress || 0) + '" dir="ltr" data-pslider ' +
          'style="background:' + progressBackground(task.progress || 0) + '" ' +
          'aria-label="' + u.esc(t('t.progress')) + '">' +
          '<span class="tp-val num" data-pval>' + (task.progress || 0) + '%</span></div>'
        : '') +
      '<div class="t-meta">' +
      (showDate && task.date
        ? '<span class="chip-date' + (late ? ' late' : '') + '">' + icon('calendar', 12) +
          u.esc(u.fmtDateShort(task.date, SL.i18n.lang)) + '</span>'
        : (!task.date ? '<span class="chip-date">' + icon('calendar', 12) + u.esc(t('t.openDate')) + '</span>' : '')) +
      '<span class="tag" style="--c:' + (s ? u.esc(s.color) : 'var(--none-subject)') + '">' +
      '<span class="dot"></span><span>' + u.esc(s ? s.name : t('t.noSubject')) + '</span></span>' +
      '<span class="badge badge-' + task.difficulty + '">' + u.esc(t('t.diff' + cap(task.difficulty))) + '</span>' +
      (late ? '<span class="badge badge-hard">' + icon('clock', 12) + u.esc(t('t.overdue')) + '</span>' : '') +
      '<button type="button" class="tpen-toggle' + (task.progressEnabled ? ' on' : '') + '" data-act="tpen" role="switch" aria-checked="' +
      (task.progressEnabled ? 'true' : 'false') + '" aria-label="' + u.esc(t('t.enableProgress')) + '"><span class="tpen-knob"></span></button>' +
      '<span class="tpen-label">' + u.esc(t('t.progress')) + '</span>' +
      '</div></div>' +
      '<button class="t-edit" data-act="edit" aria-label="' + u.esc(t('a.edit')) + '">' + icon('pencil', 17) + '</button>' +
      '</div>'
    );
  }

  function groupHTML(cls, titleKey, count, rowsHTML, emptyMsg, alldoneSpec) {
    var allBtn =
      alldoneSpec
        ? '<button class="mini-btn" data-act="alldone" ' +
          (alldoneSpec === 'backlog' ? 'data-scope="backlog"' : 'data-date="' + alldoneSpec + '"') +
          '" aria-label="' + u.esc(t('t.markAllDone')) + '" title="' + u.esc(t('t.markAllDone')) + '">' + icon('check', 15) + '</button>'
        : '';
    var head =
      '<div class="group-head ' + cls + '"><span class="g-title">' + u.esc(t(titleKey)) + '</span>' +
      allBtn +
      '<span class="g-count">' + count + '</span></div>';
    if (!count) return '<div class="task-group ' + cls + '">' + head + '<div class="g-empty-line">' + u.esc(emptyMsg) + '</div></div>';
    return '<div class="task-group ' + cls + '">' + head + rowsHTML + '</div>';
  }

  function renderListAll(listHost, animate) {
    var parts = partition();

    if (!parts.total) {
      listHost.innerHTML =
        '<div class="empty">' +
        icon('tasks', 40) +
        '<div class="e-title">' + u.esc(t('t.emptyAll')) + '</div>' +
        '<div class="e-hint">' + u.esc(t('t.emptyAllHint')) + '</div>' +
        '<button class="btn btn-primary" data-act="add">' + icon('plus', 17) + u.esc(t('t.add')) + '</button>' +
        '</div>';
      return;
    }

    listHost.innerHTML =
      groupHTML(
        'group-backlog',
        't.groupBacklog',
        parts.backlog.length,
        '<div class="stagger">' + parts.backlog.map(function (x) { return taskRowHTML(x, true); }).join('') + '</div>',
        t('t.backlogEmpty'),
        'backlog'
      ) +
      groupHTML(
        'group-upcoming',
        't.groupUpcoming',
        parts.upcoming.length,
        '<div class="stagger">' + parts.upcoming.map(function (x) { return taskRowHTML(x, true); }).join('') + '</div>',
        t('t.upcomingEmpty')
      ) +
      groupHTML(
        'group-done',
        't.groupDone',
        parts.done.length,
        '<div class="stagger">' + parts.done.map(function (x) { return taskRowHTML(x, true); }).join('') + '</div>',
        t('t.doneEmpty')
      );

    if (animate === false) {
      u.$$('.stagger', listHost).forEach(function (el) {
        el.classList.remove('stagger');
      });
    }
  }

  function renderListDay(listHost, animate) {
    var dayTasks = SL.store.tasksOn(view.selected).slice().sort(function (a, b) {
      return (a.done - b.done) || (a.createdAt - b.createdAt);
    });

    if (!dayTasks.length) {
      listHost.innerHTML =
        '<div class="empty">' +
        icon('tasks', 40) +
        '<div class="e-title">' + u.esc(t('t.emptyDay')) + '</div>' +
        '<div class="e-hint">' + u.esc(t('t.emptyDayHint')) + '</div>' +
        '<button class="btn btn-primary" data-act="add">' + icon('plus', 17) + u.esc(t('t.add')) + '</button>' +
        '</div>';
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'day-list' + (animate === false ? '' : ' stagger');
    wrap.innerHTML = dayTasks
      .map(function (x) {
        return taskRowHTML(x, false);
      })
      .join('');
    listHost.appendChild(wrap);
  }

  function weekdayName(ymdStr) {
    if (!ymdStr) return t('t.openDate');
    try {
      var base = SL.i18n.lang === 'ar' ? 'ar' : SL.i18n.lang === 'ru' ? 'ru' : 'en';
      return new Intl.DateTimeFormat(base + '-u-nu-latn', { weekday: 'long' }).format(u.parseYMD(ymdStr));
    } catch (e) {
      return '';
    }
  }

  /* Phone agenda (reference pattern): days stacked vertically, big
     weekday header + date/count sub-line + that day's tasks. */
  function renderAgenda(host) {
    var st = SL.store.get();
    var today = u.todayStr();
    if (!st.tasks.length) {
      host.innerHTML =
        '<div class="empty">' +
        icon('tasks', 40) +
        '<div class="e-title">' + u.esc(t('t.emptyAll')) + '</div>' +
        '<div class="e-hint">' + u.esc(t('t.emptyAllHint')) + '</div>' +
        '<button class="btn btn-primary" data-act="add">' + icon('plus', 17) + u.esc(t('t.add')) + '</button>' +
        '</div>';
      return;
    }
    var byDate = {};
    st.tasks.forEach(function (x) {
      (byDate[x.date] = byDate[x.date] || []).push(x);
    });
    var dates = Object.keys(byDate).filter(Boolean).sort();
    if (dates.indexOf(today) === -1) dates.unshift(today);
    if (byDate[''] && byDate[''].length) dates.push('');

    host.innerHTML = dates
      .map(function (d) {
        var list = (byDate[d] || []).slice().sort(function (a, b) {
          return (a.done - b.done) || (a.createdAt - b.createdAt);
        });
        var has = list.length > 0;
        var undone = list.some(function (x) { return !x.done; });
        var cls = 'agenda-day' + (has ? ' has-tasks' : ' empty-day') + (d === today ? ' is-today' : '');
        var sub = d === ''
          ? (has ? u.esc(t('t.count', { n: list.length })) : '')
          : u.esc(u.fmtDateShort(d, SL.i18n.lang)) + ' • ' +
          (has ? u.esc(t('t.count', { n: list.length })) : u.esc(t('t.agNoTasks')));
        var allBtn = has && undone && d !== ''
          ? '<button class="mini-btn" data-act="alldone" data-date="' + d + '" aria-label="' + u.esc(t('t.markAllDone')) + '">' + icon('check', 14) + '</button>'
          : '';
        var rows = has
          ? '<div class="ag-list">' + list.map(function (x) { return taskRowHTML(x, false); }).join('') + '</div>'
          : '';
        return (
          '<section class="' + cls + '">' +
          '<h3 class="ag-dayname">' + u.esc(weekdayName(d)) +
          (d === today ? '<span class="ag-today-chip">' + u.esc(t('a.today')) + '</span>' : '') +
          '<span class="n-line" style="flex:1;border-top:1px dashed color-mix(in srgb, var(--ink) 15%, transparent);margin-inline:6px"></span>' +
          allBtn +
          '</h3>' +
          '<p class="ag-sub">' + sub + '</p>' +
          rows +
          '</section>'
        );
      })
      .join('');
  }

  function bindListActions(root2, listHost) {
    listHost.addEventListener('click', function (e) {
      var addBtn = e.target.closest('[data-act="add"]');
      if (addBtn) {
        SL.ui.openTaskForm({ date: view.selected });
        return;
      }
      var allBtn = e.target.closest('[data-act="alldone"]');
      if (allBtn) {
        var scope = allBtn.getAttribute('data-scope');
        var day = allBtn.getAttribute('data-date');
        if (scope === 'backlog') SL.store.completeAllOverdue();
        else if (day) SL.store.completeAllOn(day);
        return;
      }
      var tpen = e.target.closest('[data-act="tpen"]');
      if (tpen) {
        var trow = tpen.closest('.task-row[data-id]');
        var tid2 = trow.getAttribute('data-id');
        var tsk2 = SL.store
          .get()
          .tasks.filter(function (x) {
            return x.id === tid2;
          })[0];
        if (tsk2) SL.store.updateTask(tid2, { progressEnabled: !tsk2.progressEnabled, progress: tsk2.progress || 0 });
        return;
      }
      var row = e.target.closest('.task-row[data-id]');
      if (!row) return;
      var id = row.getAttribute('data-id');
      var task = SL.store
        .get()
        .tasks.filter(function (x) {
          return x.id === id;
        })[0];
      if (!task) return;
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.getAttribute('data-act') === 'toggle') {
        var wasDone = task.done;
        SL.store.toggleTask(id);
        // silent re-render already replaced the DOM — replay the settle
        requestAnimationFrame(function () {
          var fresh = listHost.querySelector('.task-row[data-id="' + id + '"]');
          if (fresh && !wasDone) {
            fresh.classList.add('just-done');
          }
        });
      } else if (act.getAttribute('data-act') === 'edit') {
        SL.ui.openTaskForm({ task: task });
      }
    });

    // progress sliders: live paint on drag, commit on release (100% auto-completes)
    function paintSlider(slider) {
      var v = parseInt(slider.value, 10) || 0;
      slider.style.background = progressBackground(v);
      var lbl = slider.closest('.task-progress').querySelector('[data-pval]');
      if (lbl) lbl.textContent = v + '%';
    }
    listHost.addEventListener('input', function (e) {
      var s = e.target.closest('input[data-pslider]');
      if (s) paintSlider(s);
    });
    listHost.addEventListener('change', function (e) {
      var s = e.target.closest('input[data-pslider]');
      if (!s) return;
      var prow = s.closest('.task-row[data-id]');
      var pid = prow.getAttribute('data-id');
      SL.store.setTaskProgress(pid, parseInt(s.value, 10) || 0);
      // silent re-render is skipped while the slider holds focus — sync in place
      var tNow = SL.store
        .get()
        .tasks.filter(function (x) {
          return x.id === pid;
        })[0];
      if (tNow && tNow.done) {
        prow.classList.add('done', 'just-done');
        var chk = prow.querySelector('.check');
        if (chk) chk.setAttribute('aria-checked', 'true');
      }
    });
  }

  function render(root2, animate) {
    if (view.selected == null) init();
    var st = SL.store.get();
    var cur = SL.store.currentSemester();
    var parts = partition();

    root2.innerHTML =
      '<h1 class="page-title">' + u.esc(t('t.title')) + '</h1>' +
      '<p class="day-greeting">' + icon('calendar', 15) + '<span>' + u.esc(u.fmtDateLong(u.todayStr(), SL.i18n.lang)) + '</span></p>' +

      '<div class="card card-pad cal-card only-desktop">' +
      '<span class="cal-tape" aria-hidden="true"></span>' +
      '<div class="cal-head">' +
      '<span class="cal-title">' + u.esc(u.monthTitle(view.year, view.month, SL.i18n.lang)) + '</span>' +
      '<button class="icon-btn" data-act="prev" aria-label="' + u.esc(t('cal.prev')) + '">' + icon('chevL', 18) + '</button>' +
      '<button class="icon-btn" data-act="today">' + u.esc(t('a.today')) + '</button>' +
      '<button class="icon-btn" data-act="next" aria-label="' + u.esc(t('cal.next')) + '">' + icon('chevR', 18) + '</button>' +
      '</div>' +
      '<div data-host="cal"></div>' +
      '<div class="cal-foot">' +
      '<button class="btn btn-ghost" data-act="subjects" style="min-height:40px;padding:7px 14px;font-size:13.5px">' +
      icon('tag', 16) + u.esc(t('t.subjectsBtn')) + '</button>' +
      '</div></div>' +

      '<div class="segmented mode-seg" role="group" aria-label="' + u.esc(t('t.title')) + '">' +
      '<button type="button" data-mode="day" aria-pressed="' + (view.mode === 'day') + '">' +
      '<span>' + u.esc(t('t.modeDay')) + '</span><span class="seg-count">' + SL.store.tasksOn(view.selected).length + '</span></button>' +
      '<button type="button" data-mode="all" aria-pressed="' + (view.mode === 'all') + '">' +
      '<span>' + u.esc(t('t.modeAll')) + '</span><span class="seg-count">' + parts.total + '</span></button>' +
      '</div>' +

      '<div data-host="list-d" class="only-desktop"></div>' +
      '<div data-host="list-p" class="only-phone"></div>';

    // calendar (desktop/tablet only — hidden on phones via CSS)
    var calHost = root2.querySelector('[data-host="cal"]');
    SL.calendar.render(calHost, {
      year: view.year,
      month: view.month,
      selectedYmd: view.selected,
      lang: SL.i18n.lang,
      weekStart: st.settings.weekStart,
      animate: animate,
      dots: dotsFor,
      onSelect: function (ymd) {
        view.selected = ymd;
        if (view.mode === 'all') view.mode = 'day'; // picking a day focuses it
        render(root2, false);
        var btn = calHost.querySelector('.cal-day.selected');
        if (btn) {
          btn.classList.add('pop');
          setTimeout(function () {
            btn.classList.remove('pop');
          }, 280);
        }
      },
    });
    lastSlide = null;

    // lists: desktop = groups/day list, phone = agenda feed (CSS picks one)
    var hostD = root2.querySelector('[data-host="list-d"]');
    var hostP = root2.querySelector('[data-host="list-p"]');
    if (view.mode === 'all') {
      renderListAll(hostD, animate);
      renderAgenda(hostP);
    } else {
      renderListDay(hostD, animate);
      renderListDay(hostP, animate);
    }
    bindListActions(root2, hostD);
    bindListActions(root2, hostP);

    // header actions
    root2.querySelectorAll('[data-act]').forEach(function (btn) {
      var act = btn.getAttribute('data-act');
      btn.addEventListener('click', function () {
        if (act === 'prev' || act === 'next') {
          var d = new Date(view.year, view.month + (act === 'next' ? 1 : -1), 1);
          view.year = d.getFullYear();
          view.month = d.getMonth();
          var sel = u.parseYMD(view.selected);
          if (sel.getMonth() !== view.month || sel.getFullYear() !== view.year) {
            view.selected = u.ymd(new Date(view.year, view.month, 1));
          }
          lastSlide = act === 'next' ? 'fwd' : 'back';
          render(root2, false);
        } else if (act === 'today') {
          var now = new Date();
          view.year = now.getFullYear();
          view.month = now.getMonth();
          view.selected = u.todayStr();
          lastSlide = 'back';
          render(root2, false);
        } else if (act === 'subjects') {
          if (!cur) {
            SL.ui.toast(t('s.noCurrent'), 'error');
            SL.router.go('profile');
            return;
          }
          SL.ui.openSubjectManager(cur.sem.id);
        }
      });
    });

    // mode switch
    root2.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var m = btn.getAttribute('data-mode');
        if (m === view.mode) return;
        view.mode = m;
        render(root2, true);
      });
    });
  }

  SL.pages = SL.pages || {};
  SL.pages.tasks = {
    id: 'tasks',
    labelKey: 'nav.tasks',
    icon: 'tasks',
    render: render,
    partition: partition,
    getFab: function () {
      return {
        labelKey: 't.add',
        action: function () {
          SL.ui.openTaskForm({ date: view.selected });
        },
      };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

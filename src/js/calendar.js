/* ============================================================
   Study Live — calendar.js
   Month grid renderer. Cell = button with day number + up to
   3 colored dots (+N). today = outline, selected = ink fill.
   Weekend columns get a school-timetable tint. Supports a
   slide direction class for month-change animation.
   Depends on: utils.js
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var u = SL.utils;

  var WEEK_START = 1; // Monday for all app languages
  var WEEKEND = [5, 6]; // Saturday + Sunday column indexes in a Mon-start grid

  function isWeekendCol(col) {
    return WEEKEND.indexOf(col) !== -1;
  }

  /*
   * render(el, opts)
   * opts: { year, month, selectedYmd, lang, dots(ymd) -> [{color, done}],
   *         onSelect(ymd), slideDir: 'fwd' | 'back' | null }
   * Renders ONLY the grid + weekday header (title/nav handled by the page).
   */
  function render(el, opts) {
    var lang = opts.lang || SL.i18n.lang;
    var ws = opts.weekStart != null ? opts.weekStart : WEEK_START;
    var weeks = u.monthGrid(opts.year, opts.month, ws);
    var names = u.weekdayNames(ws, lang);
    var today = u.todayStr();

    var animateCls = opts.animate === false ? '' : ' cal-animate';
    var html = '<div class="cal-grid' + (opts.slideDir ? ' slide-' + opts.slideDir : '') + animateCls + '" role="grid">';
    html += names
      .map(function (n, col) {
        return (
          '<div class="cal-weekday' + (isWeekendCol(col) ? ' we' : '') + '" role="columnheader">' +
          u.esc(n) +
          '</div>'
        );
      })
      .join('');

    var col = 0;
    weeks.forEach(function (week) {
      week.forEach(function (cell) {
        if (!cell.ymd) {
          html += '<span class="cal-day pad' + (isWeekendCol(col) ? ' we' : '') + '" aria-hidden="true"></span>';
          col++;
          return;
        }
        var dots = (opts.dots && opts.dots(cell.ymd)) || [];
        var shown = dots.slice(0, 3);
        var extra = dots.length - shown.length;
        var classes = ['cal-day'];
        if (isWeekendCol(col)) classes.push('we');
        if (cell.ymd === today) classes.push('today');
        if (cell.ymd === opts.selectedYmd) classes.push('selected');
        html +=
          '<button type="button" class="' + classes.join(' ') + '" data-ymd="' + cell.ymd + '" ' +
          'aria-label="' + u.esc(u.fmtDateShort(cell.ymd, lang)) + '">' +
          '<span>' + cell.day + '</span>' +
          (shown.length
            ? '<span class="cal-dots" aria-hidden="true">' +
              shown
                .map(function (d) {
                  return (
                    '<i class="' + (d.done ? 'done' : '') + '" style="--d:' + u.esc(d.color) + '"></i>'
                  );
                })
                .join('') +
              (extra > 0 ? '<i class="more">+' + extra + '</i>' : '') +
              '</span>'
            : '') +
          '</button>';
        col++;
      });
    });
    html += '</div>';

    el.innerHTML = html;

    u.$$('.cal-day[data-ymd]', el).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (opts.onSelect) opts.onSelect(btn.getAttribute('data-ymd'));
      });
    });
  }

  SL.calendar = { render: render, WEEK_START: WEEK_START };
})(typeof window !== 'undefined' ? window : globalThis);

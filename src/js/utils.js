/* ============================================================
   Study Live — utils.js
   Pure helpers: DOM, dates, colors, escaping. No dependencies.
   Exposed as window.SL.utils (also module.exports for tests).
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var utils = {};

  /* ---------- DOM ---------- */

  utils.$ = function (sel, rootNode) {
    return (rootNode || document).querySelector(sel);
  };

  utils.$$ = function (sel, rootNode) {
    return Array.prototype.slice.call((rootNode || document).querySelectorAll(sel));
  };

  utils.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  utils.uid = function () {
    if (root.crypto && root.crypto.randomUUID) {
      return root.crypto.randomUUID();
    }
    // Fallback for older browsers
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return uuid.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  /* Sanitize HTML string - prevents XSS */
  utils.sanitizeHTML = function (html) {
    var doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = html;
    var scripts = doc.body.getElementsByTagName('script');
    while (scripts.length > 0) {
      scripts[0].parentNode.removeChild(scripts[0]);
    }
    // Remove event handlers and dangerous URLs
    var allElements = doc.body.getElementsByTagName('*');
    for (var i = 0; i < allElements.length; i++) {
      var attrs = allElements[i].attributes;
      for (var j = attrs.length - 1; j >= 0; j--) {
        var name = attrs[j].name.toLowerCase();
        if (name.startsWith('on')) {
          allElements[i].removeAttribute(attrs[j].name);
        }
      }
    }
    return doc.body.innerHTML;
  };

  utils.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(self, args);
      }, ms);
    };
  };

  /* ---------- Dates (local, YYYY-MM-DD keys) ---------- */

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  utils.ymd = function (d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  };

  utils.todayStr = function () {
    return utils.ymd(new Date());
  };

  utils.parseYMD = function (s) {
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  };

  utils.addDays = function (s, n) {
    var d = utils.parseYMD(s);
    d.setDate(d.getDate() + n);
    return utils.ymd(d);
  };

  utils.isValidYMD = function (s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
    var d = utils.parseYMD(s);
    return utils.ymd(d) === s;
  };

  /* Locale-aware formatting, always latin digits for consistency */
  function localeTag(lang) {
    var base = lang === 'ar' ? 'ar' : lang === 'ru' ? 'ru' : 'en';
    return base + '-u-nu-latn';
  }

  utils.fmtDateLong = function (ymdStr, lang) {
    try {
      return new Intl.DateTimeFormat(localeTag(lang), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(utils.parseYMD(ymdStr));
    } catch (e) {
      return ymdStr;
    }
  };

  utils.fmtDateShort = function (ymdStr, lang) {
    try {
      return new Intl.DateTimeFormat(localeTag(lang), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(utils.parseYMD(ymdStr));
    } catch (e) {
      return ymdStr;
    }
  };

  utils.monthTitle = function (year, monthIdx, lang) {
    try {
      return new Intl.DateTimeFormat(localeTag(lang), {
        month: 'long',
        year: 'numeric',
      }).format(new Date(year, monthIdx, 1));
    } catch (e) {
      return year + '-' + pad2(monthIdx + 1);
    }
  };

  /* Weekday names ordered from weekStart (1 = Monday) */
  utils.weekdayNames = function (weekStart, lang) {
    var out = [];
    // 2023-01-02 was a Monday
    for (var i = 0; i < 7; i++) {
      var d = new Date(2023, 0, 2 + ((weekStart - 1 + i + 7) % 7));
      try {
        out.push(
          new Intl.DateTimeFormat(localeTag(lang), { weekday: 'short' }).format(d)
        );
      } catch (e) {
        out.push(String(i));
      }
    }
    return out;
  };

  /*
   * Build a month grid: array of weeks, each week = 7 cells.
   * Cell = { ymd: 'YYYY-MM-DD' | null, day: number }
   * weekStart: 0=Sunday, 1=Monday (app default).
   */
  utils.monthGrid = function (year, monthIdx, weekStart) {
    var first = new Date(year, monthIdx, 1);
    var lead = (first.getDay() - weekStart + 7) % 7;
    var cells = [];
    for (var i = 0; i < lead; i++) cells.push({ ymd: null, day: null });
    var d = new Date(year, monthIdx, 1);
    while (d.getMonth() === monthIdx) {
      cells.push({ ymd: utils.ymd(d), day: d.getDate() });
      d.setDate(d.getDate() + 1);
    }
    while (cells.length % 7 !== 0) cells.push({ ymd: null, day: null });
    var weeks = [];
    for (var w = 0; w < cells.length / 7; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
    return weeks;
  };

  utils.isPast = function (ymdStr) {
    return ymdStr < utils.todayStr();
  };

  /* ---------- Colors ---------- */

  utils.hexNorm = function (hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    return '#' + h.toLowerCase();
  };

  utils.isHex = function (hex) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(hex || '').trim());
  };

  utils.rgb = function (hex) {
    var h = utils.hexNorm(hex).slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };

  /* Mix hex a into hex b by t (0..1). Returns hex. */
  utils.mix = function (a, b, t) {
    var ca = utils.rgb(a);
    var cb = utils.rgb(b);
    var out = ca.map(function (v, i) {
      return Math.round(v + (cb[i] - v) * t);
    });
    return (
      '#' +
      out
        .map(function (v) {
          return pad2(v.toString(16));
        })
        .join('')
    );
  };

  utils.mixRgba = function (hex, alpha) {
    var c = utils.rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
  };

  /*
   * Shade index for notes: notes of the same subject share a hue but
   * cycle through 4 tint strengths, in creation order.
   */
  utils.shadeIndex = function (note, allNotes) {
    var same = allNotes
      .filter(function (n) {
        return (n.subjectId || null) === (note.subjectId || null);
      })
      .sort(function (a, b) {
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
    var idx = same.findIndex(function (n) {
      return n.id === note.id;
    });
    return ((idx % 4) + 4) % 4;
  };

  utils.tiltFor = function (id) {
    var h = 0;
    var s = String(id || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
    return ((h / 1000) * 1.4 - 0.7).toFixed(2) + 'deg';
  };

  /* ---------- Image compression ---------- */

  /*
   * Compress an image file to a JPEG data URL (max edge 1024, q 0.72).
   * Returns a Promise<string>. Rejects if the browser cannot decode.
   */
  utils.compressImage = function (file, maxEdge, quality) {
    maxEdge = maxEdge || 1024;
    quality = quality || 0.72;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('not-image'));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('no-canvas'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('decode-failed'));
      };
      img.src = url;
    });
  };

  /* ---------- Image codec helpers (browser + node) ---------- */

  /* dataURL -> Blob. Uses atob/Uint8Array/Blob (node >= 18 compatible). */
  utils.dataURLtoBlob = function (dataUrl) {
    var parts = String(dataUrl).split(',');
    var mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    var bin = atob(parts[1] || '');
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  /* Blob -> dataURL via FileReader (browser only). Promise<string>. */
  utils.blobToDataURL = function (blob) {
    return new Promise(function (resolve, reject) {
      if (!blob) {
        reject(new Error('no-blob'));
        return;
      }
      var fr = new FileReader();
      fr.onload = function () {
        resolve(String(fr.result));
      };
      fr.onerror = function () {
        reject(fr.error || new Error('read-failed'));
      };
      fr.readAsDataURL(blob);
    });
  };

  /* ---------- Export for node tests ---------- */

  SL.utils = utils;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = utils;
  }
})(typeof window !== 'undefined' ? window : globalThis);

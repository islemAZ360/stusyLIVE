/* ============================================================
   Study Live — i18n.js
   t(key, vars), language switching, html lang/dir management.
   Depends on: strings.js
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});

  function detectLang() {
    var nav = (root.navigator && root.navigator.language) || '';
    var l = String(nav).toLowerCase();
    if (l.indexOf('ru') === 0) return 'ru';
    if (l.indexOf('en') === 0) return 'en';
    return 'ar'; // user-facing default for the primary audience
  }

  var i18n = {
    lang: 'ar',

    dir: function () {
      var meta = null;
      SL.LANGS.forEach(function (l) {
        if (l.code === i18n.lang) meta = l;
      });
      return meta ? meta.dir : 'ltr';
    },

    t: function (key, vars) {
      var dict = SL.STRINGS[i18n.lang] || SL.STRINGS.en;
      var s = dict[key];
      if (s == null) s = SL.STRINGS.en[key] || key;
      if (vars) {
        Object.keys(vars).forEach(function (k) {
          s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
        });
      }
      return s;
    },

    /* Localized name for year n (1-based) */
    yearName: function (n) {
      var words = [
        i18n.t('year.w1'),
        i18n.t('year.w2'),
        i18n.t('year.w3'),
        i18n.t('year.w4'),
        i18n.t('year.w5'),
        i18n.t('year.w6'),
        i18n.t('year.w7'),
        i18n.t('year.w8'),
      ];
      var w = n >= 1 && n <= 8 ? words[n - 1] : String(n);
      return i18n.t('year.name', { w: w });
    },

    semName: function (n) {
      return i18n.t('sem.name', { n: n });
    },

    setLang: function (code, opts) {
      if (!SL.STRINGS[code]) return;
      i18n.lang = code;
      var html = document.documentElement;
      html.setAttribute('lang', code);
      html.setAttribute('dir', i18n.dir());
      document.title = 'Study Live';
      SL.store.setLang(code);
      if (!opts || !opts.silent) {
        SL.ui.toast(i18n.t('toast.langSet'));
      }
      SL.router.rerenderAll();
    },

    init: function () {
      var saved = SL.store.get().settings.lang;
      i18n.lang = SL.STRINGS[saved] ? saved : detectLang();
      var html = document.documentElement;
      html.setAttribute('lang', i18n.lang);
      html.setAttribute('dir', i18n.dir());
      document.title = 'Study Live';
    },
  };

  SL.i18n = i18n;
})(typeof window !== 'undefined' ? window : globalThis);

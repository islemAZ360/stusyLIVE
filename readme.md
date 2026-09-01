# Study Live 📓

تطبيق ويب لتنظيم حياة الطالب: مهام بالأيام (مع قائمة التراكمات للفائت)، ملاحظات بموادك، وهيكل دراسي كامل (سنوات × فصول).
يعمل بلا إنترنت وبلا أدوات بناء — افتح `index.html` مباشرة أو ارفع المجلد على أي استضافة ثابتة.

> ملاحظة: علامة 📓 هنا في التوثيق فقط؛ داخل التطبيق تُستخدم أيقونات SVG حصرًا.

## أبرز ميزات صفحة المهام (V4.3)

- **تخطيط متجاوب**: على التابلت/الحاسوب (≥768px) تقويم شهري بدفتر حلزوني؛ وعلى الهاتف قائمة أيام عمودية (نمط Agenda): عنوان يوم كبير + التاريخ والعدد + مهامه تحته، وعنوان اليوم الحالي مميز بشارة «اليوم».
- عرضان: «كل المهام» (افتراضي) مجمّعة إلى **التراكمات** (فائتة غير منجزة) / **القادمة** / **المنجزة**، و«مهام اليوم» بقائمة الورق المسطّر.
- إنجاز/إلغاء إنجاز أي مهمة من أي مجموعة، تعديل وحذف، وصف اختياري لكل مهمة، وإضافة مهام لأيام ماضية بلا قيد.

## التشغيل

- **مباشرة:** افتح `index.html` في المتصفح (يعمل عبر `file://` لأن الملفات سكربتات كلاسيكية لا وحدات ES).
- **استضافة ثابتة:** ارفع المجلد كاملًا (GitHub Pages / Netlify / أي خادم ملفات ثابتة).
- على الهاتف: أضفه للشاشة الرئيسية — يوجد `manifest.webmanifest` فيعمل كتطبيق مستقل.

## البنية

```
study live/
├── index.html            ← القشرة: header + main + bottom-nav + FAB
├── manifest.webmanifest  ← PWA كامل (أيقونات PNG + maskable للتثبيت)
├── sw.js                 ← Service Worker: عمل بلا إنترنت + تحديث بالتخزين المؤقت
├── css/
│   ├── fonts.css         ← @font-face للخطوط (محلي): Manrope + IBM Plex Sans Arabic
│   ├── tokens.css        ← كل الألوان والقياسات (فاتح/مضلم)
│   ├── base.css          ← الهيكل، التنقل، FAB، الإحصاءات، الحركات
│   ├── components.css    ← أزرار/حقول/شرائح/نوافذ/تقويم
│   └── pages.css         ← تفاصيل صفحات المهام/الملاحظات/الملف/النظرة العامة
├── js/
│   ├── utils.js          ← دوال نقية: تواريخ، ألوان، DOM، ترميز الصور
│   ├── strings.js        ← قواميس ar/ru/en (أضف لغة هنا)
│   ├── db.js             ← IndexedDB لصور الملاحظات (مع سقوط آمن لـ localStorage)
│   ├── store.js          ← مصدر الحقيقة (مخطط v3) + ترحيل تلقائي + حفظ localStorage
│   ├── i18n.js           ← t() + تبديل اللغة واتجاه الصفحة
│   ├── components.js     ← أيقونات SVG، نوافذ سفلية، نماذج المهام/الملاحظات، مدير المواد
│   ├── calendar.js       ← شبكة الشهر (بداية أسبوع قابلة للضبط)
│   ├── pages/
│   │   ├── overview.js   ← النظرة العامة (الصفحة الرئيسية): إحصاءات + هذا الأسبوع
│   │   ├── tasks.js      ← صفحة المهام
│   │   ├── notes.js      ← صفحة الملاحظات
│   │   ├── stats.js      ← الإحصائيات + مؤشرات الوضع مع المواد (بتاريخ)
│   │   └── profile.js    ← الملف الشخصي + التفضيلات + عن التطبيق
│   ├── router.js         ← سجل الصفحات + شريط التنقل السفلي
│   └── app.js            ← الإقلاع: ثيم/لغة/ترحيب + ترحيل الصور + تسجيل SW
├── assets/
│   ├── icon.svg + icon-180/192/512.png + icon-512-maskable.png
│   └── fonts/  Manrope (lat+cyr) + IBM Plex Sans Arabic (4 أوزان)
└── tests/  smoke.js (منطق) + server.js (معاينة محلية)
```

## كيف تضيف صفحة جديدة (3 خطوات)

1. أنشئ `js/pages/mypage.js` وصدّر كائنًا بنفس شكل الصفحات:

```js
(function (root) {
  var SL = root.SL;
  SL.pages = SL.pages || {};
  SL.pages.mypage = {
    id: 'mypage',           // فريد
    labelKey: 'mp.title',   // مفتاح ترجمة للعنوان
    icon: 'plus',           // اسم أيقونة من components.js (ICONS)
    render: function (rootEl) { rootEl.innerHTML = '<h1 class="page-title">…</h1>'; }
  };
})(window);
```

2. أضف `<script src="js/pages/mypage.js"></script>` في `index.html` قبل `js/app.js`.
3. سجّلها في `app.js`: أضف `SL.pages.mypage` داخل قائمة `SL.router.register([...])`.

الشريط السفلي والتنقل والانتقالات تعمل تلقائيًا.

## كيف تضيف لغة جديدة

1. في `js/strings.js`: أضف عنصرًا في `SL.LANGS` (`{code, native, dir}`) وانسخ أي قاموس وترجمه — **نفس المفاتيح تمامًا** (الفحص: `node tests/smoke.js` يكشف أي مفتاح ناقص).
2. كل شيء آخر (الاتجاه RTL/LTR، التواريخ، الأسماء) يتكيف تلقائيًا عبر `Intl`.

## نموذج البيانات (localStorage: `studyLive.v1`)

```js
{
  settings: { lang, theme },
  profile:  { degree, specialty, group },
  academic: { years: [ { id, semesters: [ { id, status: 'current'|'done'|'future' } ] } ] },
  subjects: [ { id, semesterId, name, color, standing? } ],   // standing = 0..100 مؤضعك معها
  tasks:    [ { id, title, description, date: 'YYYY-MM-DD', difficulty: 'hard'|'easy'|'light', subjectId, done, createdAt } ],
  notes:    [ { id, title, text, subjectId, images: [id|dataURL], createdAt, updatedAt } ],
  standingLog: [ { id, subjectId, value, date: 'YYYY-MM-DD', at } ],  // سجل تغييرات مؤشرات المواد
  vault:    { pinHash, hint, entries: [ { id, title, username, url, password, description } ] }
  // ⚠ الخزنة تُستثنى كليًا من التصدير — كلمات السر لا تغادر الجهاز
}
```

- الملاحظات لنفس المادة تأخذ لونها بـ 4 درجات تدرّج (تُحسب بترتيب الإنشاء).
- الصور تُضغط تلقائيًا (أقصى ضلع 1024px، JPEG ~72%) قبل التخزين.
- تصدير/استيراد نسخة JSON من صفحة الملف الشخصي.

## حدود معروفة (نقاط توسع مستقبلية)

- النصوص في localStorage، **صور الملاحظات في IndexedDB** (بلا سقف عملي، مع سقوط آمن إلى localStorage عند عدم توفره) — الترحيل من النسخ القديمة تلقائي.
- Service Worker يعمل عند الاستضافة عبر http/https فقط؛ فتح `index.html` مباشرة (file://) يعمل كاملًا لكن بلا تخزين مؤقت للعمل دون اتصال ولأسة التثبيت.
- أسماء السنوات/الفصول تلقائية («السنة الأولى»، «الفصل الثاني») — إعادة التسمية Custom تُضاف لاحقًا.
- تزامن سحابي بين الأجهزة يحتاج خادمًا — التصدير/الاستيراد اليدوي متاح الآن ويشمل الصور.

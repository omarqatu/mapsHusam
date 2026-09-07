# دليل الواجهة الأمامية

## أين أعدل؟

- HTML الصفحات: `public/*.html`.
- JavaScript الخريطة: `public/js/main.js` و`layers.js` والملفات المرتبطة.
- JavaScript البحث بدون خريطة: `public/js/no-map-search.js` و`market-search.js`.
- CSS العام: `public/css/*.css`.
- React والخدمات: `src/`.

## الصفحة الرئيسية

الصفحة الرئيسية العملية هي `public/original-index.html`. الخريطة تعتمد على OpenLayers وملفات JavaScript محمّلة من `public/ol` وCDN عند الحاجة.

## البحث بدون خريطة

`public/no-map-search.html` يحتوي الفئات، البحث العلوي، الفلاتر، النتائج، التقييمات والوسائط. ملف `no-map-mobile.js` يطبق حالات الهاتف والتابلت حتى عرض 1024px.

## قواعد responsive

- القواعد العامة في ملف CSS الخاص بالصفحة.
- قواعد الخريطة الخاصة بالموبايل في `mobile-tabs.css`.
- السلوك الديناميكي مثل تغيير الاتجاه والسحب في ملفات JavaScript المخصصة.
- اختبر عمودي وأفقي للهاتف والتابلت بعد كل تغيير بصري.

## التحميل والبناء

ملفات `public` تُنسخ كما هي إلى `dist` عند تنفيذ `npm run build`. لا تعدل النسخة داخل `dist` مباشرة.

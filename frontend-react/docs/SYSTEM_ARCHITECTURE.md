# بنية النظام

## البنية الحالية

```text
المتصفح
  ├─ Vite أثناء التطوير أو dist عند النشر
  ├─ public/original-index.html
  │   ├─ OpenLayers والخريطة
  │   ├─ لوحات البحث والتحرير
  │   └─ mobile-tabs.js للموبايل والتابلت
  └─ public/no-map-search.html
      ├─ البحث والفلاتر
      └─ no-map-mobile.js للموبايل والتابلت

الصفحتان تتصلان بـ:
  server.js في مجلد PSM الأب
      ├─ APIs
      ├─ PostgreSQL
      └─ GeoServer proxy
```

## React

`src/App.jsx` هو مدخل React الحالي، ويُستخدم كحاوية للواجهة القديمة عبر iframe. لا تفترض أن كل ملفات `src` تتحكم تلقائيًا في صفحات `public`.

## طبقة الخدمات

`src/services` طبقة API ووظائف قابلة لإعادة الاستخدام. `public/js/services-bridge.js` جسر اختياري مع fallback مباشر، وليس بديلًا كاملًا لكل ملفات الواجهة.

## الموبايل والتطبيق الأصلي

- الخريطة: `mobile-tabs.js` و`mobile-tabs.css`.
- البحث بدون خريطة: `no-map-mobile.js` و`no-map-search.css`.
- WebView: `mobile-app-bridge.js`.
- التطبيق الأصلي Android/iOS غير موجود داخل هذا المجلد؛ الموجود هو عقد التواصل فقط.

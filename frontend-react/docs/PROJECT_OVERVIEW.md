# نظرة عامة على المشروع

## النطاق

المجلد الحالي `frontend-react` هو واجهة منصة خريطة الخدمات الفلسطينية. التطبيق الفعلي متعدد الصفحات ويستخدم ملفات `public`، بينما يحتوي `src` على واجهة React وطبقة خدمات مساندة.

## الصفحات الأساسية

- `public/original-index.html`: الخريطة التفاعلية الرئيسية.
- `public/no-map-search.html`: البحث بدون خريطة.
- `public/dashboard.html`: لوحة الإدارة والإحصائيات.
- `public/admin-users.html`: إدارة المستخدمين.
- `public/notifications-panel.html`: عرض الإشعارات.
- `public/widgets-admin.html`: إدارة بيانات المعلومات الحية.
- `public/widgets-portal.html` و`widgets-ticker.html`: بطاقات وشريط المعلومات الحية.

## التقنيات

- React وReactDOM وVite داخل `src`.
- JavaScript تقليدي متعدد الملفات داخل `public/js`.
- OpenLayers وProj4 للخريطة.
- Node/Express وPostgreSQL في المجلد الأب `PSM` عبر `server.js`.
- GeoServer مصدر طبقات الخرائط الخارجية.

## أوامر الواجهة

```bash
npm run dev
npm run build
npm run preview
```

`npm run build` ينشئ `dist` وينسخ ملفات `public` إليه. لا تعدل `dist` يدويًا.

## قاعدة التعديل

عدّل الواجهة الحالية في `public`، وعدّل مكونات React في `src` فقط عندما تكون الصفحة تستخدمها فعليًا. أي تغيير في API أو قاعدة البيانات يجب مراجعته مع `server.js` الموجود في المجلد الأب.

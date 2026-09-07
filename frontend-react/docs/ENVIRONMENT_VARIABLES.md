# متغيرات البيئة

## الواجهة

لا تعتمد واجهة React الحالية على متغيرات `VITE_*` ظاهرة؛ تستخدم `window.location.origin` ومسارات نسبية، ويحدد `vite.config.js` proxy التطوير.

## الخادم الخلفي

متغيرات backend موجودة في ملف `.env` بالمجلد الأب `PSM`، وتشمل عادة:

- `PORT` و`NODE_ENV`.
- إعدادات PostgreSQL لقواعد الخدمات والعقارات.
- `GEOSERVER_TARGET`.
- `ALLOWED_ORIGINS`.
- `JWT_SECRET` و`SESSION_SECRET`.
- حدود الطلبات وخصائص Helmet وCORS.

## قواعد مهمة

- لا تنسخ قيم الأسرار إلى Markdown أو JavaScript.
- استخدم `.env.example` كقالب دون أسرار حقيقية.
- بعد تغيير متغير backend أعد تشغيل الخادم.
- بعد تغيير proxy في Vite أعد تشغيل Vite.

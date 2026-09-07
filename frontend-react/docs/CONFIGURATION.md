# إعداد المشروع

## إعداد Vite

`vite.config.js` يحدد:

- منفذ التطوير `5173`.
- proxy لمسارات `/api` و`/socket.io` إلى الخادم المحلي.
- proxy لمسار `/geoserver-proxy` أثناء التطوير.
- مجلد `public` كمجلد static.
- مخرج البناء `dist`.

إذا كان المنفذ مستخدمًا، قد ينتقل Vite إلى منفذ آخر؛ تأكد من عنوان proxy والصفحة التي تختبرها.

## إعداد الخريطة

`public/js/config.js` يحتوي إعدادات API النسبية وطبقات وخصائص الواجهة. لا تضع فيه أسرارًا.

## إعداد Widgets

`public/js/widgets-config.js` يحتوي البيانات اليدوية وإعدادات Open-Meteo وAladhan وفترات التحديث.

## إعداد التطبيق

- التطوير: `npm run dev` من `frontend-react`.
- البناء: `npm run build`.
- المعاينة: `npm run preview`.
- الخادم الخلفي: من المجلد الأب عبر `npm start`.

لا تعدّل إعدادات backend من ملفات الواجهة؛ راجع `.env` و`server.js` في المجلد الأب.

# توثيق نظام المعلومات الحية

هذا النظام يعمل من ملفات `public` ويُستخدم في صفحة الخريطة وصفحة البحث بدون خريطة.

## الملفات المسؤولة

- `js/widgets-config.js`: البيانات اليدوية، إعدادات APIs، وفترات التحديث.
- `js/widgets-ticker.js`: جلب البيانات، بناء البطاقات، الشريط المتحرك، والبوابة التفصيلية.
- `css/widgets-ticker.css`: شريط المعلومات المختصر.
- `css/widgets-portal.css`: البوابة التفصيلية وبطاقاتها.
- `widgets-ticker.html`: صفحة/حاوية الشريط عند الحاجة.
- `widgets-portal.html`: البطاقات التفصيلية.
- `widgets-admin.html`: تعديل البيانات اليدوية وترتيب العناصر للمشرف.

## مجموعات البيانات الحالية

### بيانات يدوية

تُعدّل من `js/widgets-config.js` داخل `WIDGETS_MANUAL_DATA`:

- العملات.
- الذهب والفضة.
- المحروقات والغاز.
- النقل بين المدن.
- النقل الداخلي.
- المناسبات.

بعد تعديل قيمة أو اسم أو وحدة، لا تعدّل HTML يدويًا؛ يبني `widgets-ticker.js` البطاقات من الإعدادات.

### بيانات خارجية أو حية

- الطقس: Open-Meteo، بدون مفتاح API، لمدن فلسطين الموجودة في `WIDGETS_API_CONFIG.weather.cities`.
- الصلاة: Aladhan حسب الرابط الموجود في `WIDGETS_API_CONFIG.prayer.url`.
- التقويم: Aladhan حسب `WIDGETS_API_CONFIG.calendar.url`.
- حالة الطرق: تُجلب من طبقة `road_barriers` عبر بيانات السيرفر.
- حالة محطات الوقود: تُجلب من طبقة `fuel_stations` عبر بيانات السيرفر.
- بيانات المجموعات والتهيئة: `/api/widgets-data`.

لا تستخدم endpoints افتراضية مثل `/api/currency-rates` أو `/api/gold-prices` إلا إذا أُضيفت فعليًا إلى السيرفر والإعدادات.

## إعداد البيانات اليدوية

مثال:

```js
const WIDGETS_MANUAL_DATA = {
  fuel: [
    { id: "fuel-diesel", label: "سولار", value: "8.56", unit: "شيكل/لتر" },
  ],
};
```

كل عنصر يحتاج `id` فريدًا داخل مجموعته. الحقول المهمة:

- `label`: الاسم الظاهر.
- `value`: القيمة الظاهرة.
- `unit`: الوحدة.
- `date` و`notes`: للمناسبات عند الحاجة.

حالة الطرق لا تُعدّل من `traffic` حاليًا؛ القائمة فارغة لأن مصدرها طبقة الخريطة والـ API.

## إعداد APIs

داخل `WIDGETS_API_CONFIG`:

```js
const WIDGETS_API_CONFIG = {
  weather: {
    enabled: true,
    updateInterval: 1800000,
    forecastDays: 3,
    cities: {
      /* مدن وإحداثيات */
    },
  },
  prayer: {
    enabled: true,
    url: "https://api.aladhan.com/...",
    updateInterval: 3600000,
  },
  calendar: {
    enabled: true,
    url: "https://api.aladhan.com/...",
    updateInterval: 86400000,
  },
};
```

- `enabled: false` يوقف جلب المجموعة.
- `updateInterval` بالمللي ثانية.
- لا تضع مفاتيح سرية داخل `public`; استخدم backend proxy إذا احتاج المصدر إلى مفتاح.
- الطقس يبني طلب Open-Meteo داخليًا من إحداثيات المدن، لذلك لا يحتاج URL يدويًا لكل مدينة.

## واجهات السيرفر المستخدمة

- `GET /api/widgets-data`: إعدادات أو بيانات Widgets التي يوفرها backend.
- `GET /api/search-features?...`: جلب معالم `road_barriers` و`fuel_stations` عند تحديث الحالة الحية.

توجد أيضًا طلبات API عامة داخل المشروع، لكن لا تُعد جزءًا من مصدر البيانات اليدوي لهذا النظام إلا إذا استُخدمت من `widgets-ticker.js` فعليًا.

## تاريخ آخر تحديث

عدّل `WIDGETS_LAST_UPDATED` في `widgets-config.js` بعد تعديل بيانات يدوية:

```js
const WIDGETS_LAST_UPDATED = {
  currency: "29/08/2026",
  gold: "29/08/2026",
  fuel: "29/08/2026",
};
```

الطقس والطرق والمحطات والبيانات التي تأتي حيًا تعرض تاريخها من وقت الجلب أو من بيانات السيرفر.

## طريقة الاختبار

1. عدّل `js/widgets-config.js` فقط للبيانات اليدوية.
2. افتح الخريطة وصفحة `no-map-search.html`.
3. اختبر الشريط والبوابة التفصيلية على الهاتف والتابلت.
4. اختبر فشل API؛ يجب أن تبقى الصفحة قابلة للاستخدام مع رسالة أو قيمة احتياطية.
5. شغّل `npm run build` لتحديث نسخة `dist`.

## ملاحظة النشر

`public/WIDGETS-API-DOCUMENTATION.md` هو المصدر. النسخة الموجودة في `dist` تُحدّث تلقائيًا بواسطة Vite، ولا يجب تحريرها يدويًا.

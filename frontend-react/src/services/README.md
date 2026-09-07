# توثيق الخدمات الحالية

لرؤية العلاقة بين هذه الخدمات وملفات `public` والخادم وقاعدة البيانات، راجع [../../docs/FULL_PROJECT_GUIDE.md](../../docs/FULL_PROJECT_GUIDE.md).

هذا المجلد يحتوي طبقة خدمات React المساندة. التطبيق الحالي ما زال يعمل أساسًا من ملفات `public` القديمة متعددة الصفحات، لذلك لا تفترض هذه الخدمات أنها تستبدل ملفات `public/js` تلقائيًا.

## خريطة المشروع

```text
src/
  services/
    api.js          طلبات API المركزية المستخدمة من React
    coreService.js  إحداثيات، مزودون مرتبطون، إحصائيات، تقييمات، بحث
    mobileService.js خدمات تجريبية/مساندة للتنقل والإيماءات ووضع الهاتف
    index.js        نقطة التصدير العامة
  hooks/useApi.js   Hooks لجلب البيانات داخل React

public/
  js/services-bridge.js جسر اختياري لعرض بعض خدمات React عبر window.AppServices
```

## حالة التشغيل الحالية

- صفحات الخريطة والبحث بدون خريطة تُحمّل من `public/original-index.html` و`public/no-map-search.html`.
- منطق الخريطة الفعلي موجود في ملفات `public/js` مثل `main.js` و`layers.js` و`mobile-tabs.js`.
- منطق البحث بدون خريطة موجود في `public/js/no-map-search.js` و`no-map-mobile.js`.
- `services-bridge.js` محمّل في صفحة الخريطة ويحتوي fallback مباشر إلى API. صفحة البحث بدون خريطة لا تحمّله حاليًا.
- `mobile-app-bridge.js` منفصل عن هذا المجلد، ومخصص لتواصل WebView المستقبلي مع تطبيق أصلي.

## API المتوفر في React

في `src/services/api.js` توجد الدوال التالية:

- `API.ratings.getFeatureRatings(serviceLayer, featureId)`
- `API.ratings.getPendingComments(userId)`
- `API.providers.getLinkedFeatures()`
- `API.stats.getPlatformStats()`
- `API.auth.verifySession()`
- `API.serviceRequests.getPending(providerUserId)`
- `API.search.searchFeatures(params)`

كلها تستخدم مسارات نسبية عبر `window.location.origin`، وتعيد JSON، وتحاول الطلب حتى ثلاث مرات عند الفشل. لا تضع كلمات مرور أو مفاتيح قواعد البيانات في الواجهة.

## الخدمات الأساسية

`coreService.js` يوفر:

- `CoordinateUtils`: استخراج إحداثيات OpenLayers وإنشاء روابط مشاركة.
- `ProviderService`: تحديث Cache للمعالم المرتبطة بمزودي الخدمة والتحقق منها.
- `StatsService`: جلب إحصائيات المنصة وتنسيق الأرقام.
- `RatingsService`: التقييمات والتعليقات المعلقة.
- `SearchService`: استدعاء البحث المركزي.

`mobileService.js` يوفر أدوات عامة، لكنه ليس المشغل الفعلي لنظام تبويبات الخريطة الحالي. النظام الفعلي هو `public/js/mobile-tabs.js`، لذلك يجب عدم تعديل خدمة React واعتبار ذلك تعديلًا للخريطة إلا بعد نقل الاستخدام إليها صراحة.

## الاستخدام داخل React

```js
import { API, CoordinateUtils, StatsService } from "../services";

const stats = await StatsService.getStats();
const ratings = await API.ratings.getFeatureRatings("electrician", 123);
const coords = CoordinateUtils.getFeatureCoords(feature);
```

بالنسبة إلى Hooks:

```js
import { usePlatformStats, useRatings, useSearch } from "../hooks/useApi";

const stats = usePlatformStats();
const ratings = useRatings(serviceLayer, featureId);
const results = useSearch(params, true);
```

## الاستخدام داخل public

لا تعتمد ملفات `public/js` على import من React. عند تحميل `services-bridge.js` يمكن استخدام:

```js
const stats = await window.AppServices.StatsService.getStats();
const linked = window.AppServices.ProviderService.isFeatureLinked(
  "electrician",
  123,
);
```

ملاحظة مهمة: لا يوجد حاليًا تسجيل تلقائي لـ `window.CoreService` من تطبيق React، لذلك يعمل fallback المباشر في الجسر في النسخة الحالية. لا تعتبر إضافة خدمة إلى `src/services` كافية لتغيير ملفات `public` إلا بعد ربطها صراحة.

## قواعد التعديل

1. تعديل واجهة الخريطة أو البحث يتم في `public` ما دام التطبيق متعدد الصفحات الحالي هو المشغل الفعلي.
2. إضافة وظيفة مشتركة لـ React تبدأ في `src/services` ثم تُصدّر من `src/services/index.js`.
3. إذا احتاجتها صفحات `public`، أضف facade أو fallback في `public/js/services-bridge.js`.
4. لا تعدّل `dist` يدويًا؛ شغّل `npm run build` بعد اختبار المصدر.
5. بعد كل تغيير مشترك اختبر الخريطة، البحث بدون خريطة، ومقاسات الهاتف والتابلت.

## أوامر التحقق

```bash
npm run build
```

هذا يبني React وينسخ ملفات `public` إلى `dist`. تشغيل `npm run dev` يخص Vite ويستخدم proxy لمسارات `/api` إلى السيرفر المحلي، بينما تشغيل backend يتم من مجلد `PSM` الأصلي عبر `npm start`.

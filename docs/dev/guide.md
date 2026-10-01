# دليل المبرمج

قواعد الشغل (ممنوعات، أسلوب الكود، التقنيات الثابتة): [`CLAUDE.md`](../../CLAUDE.md).
التشغيل المحلي والحسابات التجريبية والتجارب التلقائية: [`dev/README.md`](../../dev/README.md).
سجل كل تغيير بالسيرفر (شو، ليش، كيف تتأكد): [`docs/react-migration/PLAN.md`](../react-migration/PLAN.md) ← «Server changes».

## البنية

```text
server.js                  Express + PostgreSQL (قاعدتين: services_db و realestate) + socket.io + بروكسي GeoServer
lib/thefuelprice.js        قراءة أسعار المحروقات (مع اختبار)
web/src/
  api/                     كل نداء للسيرفر: دالة typed بملف لكل مجال + client.ts (التوكن، 401 ← خروج)
                           geoserver.ts لقراءات GeoServer (بدون توكن التطبيق)
  features/<ميزة>/         صفحات الميزة ومكوّناتها و model.ts (منطق بدون واجهة، عليه اختبارات)
  components/              الهيدر، القائمة، الفوتر…  ← components/ui/ مكوّنات عامة (زر، حوار، كرت…)
  routes/routes.ts         كل الصفحات وصلاحياتها
  store/authStore.ts       المستخدم الحالي (Zustand)
  locales/{ar,en}.json     كل النصوص
  lib/                     أدوات عامة (تنسيق، نص منسّق، PWA…)
web/e2e/                   Playwright: تجارب بمتصفح حقيقي على السيرفر الحقيقي
```

| الميزة | المجلد |
|---|---|
| الخريطة، الطبقات، البطاقة المنبثقة، التعديل (WFS-T)، لوحة المزوّد | `features/map/` (`registry/` قائمة أنواع الخدمات) |
| البحث بدون خريطة (`/search`) | `features/search/` |
| طلب الخدمة، الدردشة، التأكيد، التقييم | `features/requests/` |
| أضف نشاطك + مراجعة المدير | `features/listing-submissions/` |
| الإشعارات (وإرسالها للمدير) | `features/notifications/` |
| الإدارة | `admin-users/`، `admin-dashboard/`، `admin-widgets/`، `admin-texts/`، `admin-visibility/` |
| تطبيق إعدادات الإدارة على كل الموقع | `text-overrides/` (النصوص)، `visibility/` (إظهار/إخفاء) |
| المعلومات الحية | `features/widgets/` |

### server.js — وين كل إشي

| من سطر تقريبًا | القسم |
|---|---|
| 30–250 | الإعدادات، الأمان (CORS، helmet، حدود الطلبات، قفل الدخول) |
| 250–520 | الاتصال بالقواعد، إنشاء الجداول والأعمدة تلقائيًا (`ensure…`)، `ALLOWED_LAYERS` |
| 520–700 | الجلسات (JWT، `requireAuth`، `requireAdmin`)، حد الطلبات لكل مستخدم |
| 700–1130 | إحصائيات عامة، أسعار، محروقات، خدمة المزوّد |
| 1130–1570 | تحديث حالة وموقع المزوّد، البحث |
| 1570–2230 | التسجيل، كلمة السر، التحقق من الجلسة |
| 2230–3260 | إدارة المستخدمين، المعلومات الحية، النصوص |
| 3260–4250 | طلبات الخدمة، الدردشة، التقييمات، الإشعارات |
| 4250–4610 | أضف نشاطك، أرقام التواصل، تقديم الواجهة وتحويل الروابط القديمة |
| 4610– | socket.io (غرفة لكل مستخدم `user:<id>`) |

## إضافة نوع خدمة

كل الخدمات بجدول واحد `service_all`، والنوع بعمود `discriminator`. ما في جدول ولا SQL جديد.

1. سطر بـ `web/src/features/map/registry/services.ts` (الشرح بأول الملف). كل قوائم الأنواع بالموقع بتنبني منه.
2. اسمه بـ `web/src/locales/ar.json` و `en.json` تحت `services.<key>`.
3. المفتاح بـ `ALLOWED_LAYERS` بـ `server.js` (تغيير سيرفر: commit لحاله + سطر بـ PLAN.md).
4. `npm test` — `registry.test.ts` بيفشل إذا نسيت خطوة.

## إضافة طبقة عقارات

كل طبقة عقارات جدول لحاله بقاعدة `realestate`.

1. `database/add_realestate_layer.sql`، ثم انشرها بـ GeoServer (workspace `realestate`).
2. سجّلها بالواجهة بثلاث أماكن:
   - `features/map/config.ts` (الطبقة).
   - `features/map/edit/schema.ts` (حقول التعديل).
   - `features/map/search/globalSearch.ts` (`REAL_ESTATE_API`).
3. اسمها بالـ locales، والمفتاح بـ `ALLOWED_LAYERS`.

## الفحوصات

```bash
cd web && npm run typecheck && npm run lint && npm test           # لازم قبل أي commit
cd web && VITE_LIVE_API=http://localhost:3000 npm test            # + على السيرفر الحقيقي المحلي
cd web && npm run e2e                                             # متصفح حقيقي، شاشة كمبيوتر وجوال
cd web && E2E_FLOWS=1 npm run e2e -- flows --project=desktop      # الأدوار: طلب، دردشة، تقييم، مزوّد، مدير
```

`ci.yml` وخطوة النشر بيشغّلوا الـ typecheck والـ lint والاختبارات والبناء. التجارب بالمتصفح بتحتاج قاعدة وGeoServer
محليين، فلازم تشغّلها بإيدك قبل الدمج.

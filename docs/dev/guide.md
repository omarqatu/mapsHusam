# دليل المبرمج

قواعد الشغل (ممنوعات، أسلوب الكود، التقنيات الثابتة): [`CLAUDE.md`](../../CLAUDE.md).
التشغيل المحلي والحسابات التجريبية والتجارب التلقائية: [`dev/README.md`](../../dev/README.md).
سجل كل تغيير بالسيرفر (شو، ليش، كيف تتأكد): [`docs/react-migration/PLAN.md`](../react-migration/PLAN.md) ← «Server changes».

## البنية

```text
server.js + server/        Express + PostgreSQL (قاعدتين: services_db و realestate) + socket.io + بروكسي GeoServer
lib/thefuelprice.js        قراءة أسعار المحروقات (مع اختبار)
shared/service-types.json  قائمة أنواع الخدمات: الواجهة والسيرفر بيقرأوها
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

### السيرفر — وين كل إشي

`server.js` بس بيشغّل: بيستورد الملفات بالترتيب (كل ملف بيسجّل مساراته لما ينستورد)، وبيبدأ الاستماع.

| الملف | شو فيه |
|---|---|
| `server/app.js` | الإعدادات والأمان (CORS، helmet، حدود الطلبات، قفل الدخول)، تطبيق Express، socket.io |
| `server/database.js` | إعدادات القواعد وGeoServer، الاتصال، إنشاء الجداول والأعمدة تلقائيًا (`ensure…`) |
| `server/layers.js` | `ALLOWED_LAYERS` (من `shared/service-types.json` + `OTHER_LAYERS`)، أسماء الطبقات بالعربي |
| `server/auth.js` | الجلسات (JWT)، `requireAuth`، `requireAdmin`، حد الطلبات لكل مستخدم |
| `server/state.js` | كاشات مشتركة، مين متصل، إرسال إشعار (`notifyUser`) |
| `server/listings.js` | فحص بيانات «أضف نشاطك» (للتسجيل وللطلبات) |
| `server/routes/*.js` | المسارات، ملف لكل موضوع: `auth`، `search`، `requests` (الطلبات والدردشة والتقييم)، `admin-users`، `widgets`… |
| `server/frontend.js` | آخر إشي: `/healthz`، 404 لـ `/api`، تقديم `web/dist` وتحويل الروابط القديمة، معالج الأخطاء |
| `server/sockets.js` | socket.io (غرفة لكل مستخدم `user:<id>`) |

بدك مسار معيّن؟ `grep -rn "'/api/…'" server/`. مسار جديد = بملف الموضوع تبعه. موضوع جديد = ملف بـ `server/routes/`
واستيراده بـ `server.js` **قبل** `server/frontend.js`. `npm run check:server` بيتأكد إنه كل الملفات مستوردة وكل import موجود.

## إضافة نوع خدمة

كل الخدمات بجدول واحد `service_all`، والنوع بعمود `discriminator`. ما في جدول ولا SQL جديد.

1. عنصر بـ `shared/service-types.json` (الحقول مشروحة بأول `web/src/features/map/registry/services.ts`). الواجهة
   والسيرفر (`ALLOWED_LAYERS`) بيقرأوا نفس الملف، وكل قوائم الأنواع بالموقع بتنبني منه.
2. اسمه بـ `web/src/locales/ar.json` و `en.json` تحت `services.<key>`.
3. `npm test` — `registry.test.ts` بيفشل إذا نسيت خطوة أو كتبت حقل غلط.

## إضافة طبقة عقارات

كل طبقة عقارات جدول لحاله بقاعدة `realestate`.

1. `database/add_realestate_layer.sql`، ثم انشرها بـ GeoServer (workspace `realestate`).
2. سجّلها بالواجهة بـ `REAL_ESTATE_LAYERS` بـ `features/map/config.ts`. المحرر والبحث بياخذوا اسمها من هناك. إذا
   حقولها مختلفة عن الشقق أو الأراضي، ضيف حقولها بـ `features/map/edit/schema.ts`.
3. اسمها بالـ locales، واسم الطبقة بـ `OTHER_LAYERS` بـ `server/layers.js`.

## الفحوصات

```bash
cd web && npm run typecheck && npm run lint && npm test           # لازم قبل أي commit
npm run check:server                                              # السيرفر: كل الملفات والـ imports (بدون تشغيل)
cd web && VITE_LIVE_API=http://localhost:3000 npm test            # + على السيرفر الحقيقي المحلي
cd web && npm run e2e                                             # متصفح حقيقي، شاشة كمبيوتر وجوال
cd web && E2E_FLOWS=1 npm run e2e -- flows --project=desktop      # الأدوار: طلب، دردشة، تقييم، مزوّد، مدير
```

**قبل الدمج على `main`:** `dev/check-all.sh` بيشغّل كل اللي فوق مع بعض على سيرفر محلي خاص فيه.

`ci.yml` وخطوة النشر بيشغّلوا الـ typecheck والـ lint والاختبارات والبناء. التجارب بالمتصفح بتحتاج قاعدة وGeoServer
محليين، فلازم تشغّلها بإيدك قبل الدمج.

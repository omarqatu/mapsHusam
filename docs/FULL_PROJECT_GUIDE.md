# الدليل الموحد للمشروع كاملًا

هذا الملف يجمع صورة المشروع من المجلد الأب `PSM` ومن واجهة `frontend-react`. المصدر النهائي لأي تفصيل هو الكود الفعلي، ثم ملفات SQL والإعدادات، ثم هذا التوثيق.

## 1. خريطة المجلدات

```text
PSM/
  server.js                 الخادم الخلفي Express وSocket.io
  package.json              حزم وأوامر الخادم
  .env                      إعدادات الخادم السرية
  database/                 سكربتات PostgreSQL/PostGIS
  public/                   ملفات الموقع التي يخدمها الخادم مباشرة
    original-index.html     الخريطة الرئيسية
    no-map-search.html      البحث بدون خريطة
    dashboard.html          لوحة إحصائيات وطلبات الإدارة
    admin-users.html        إدارة المستخدمين
    admin-view-user.html    مشاهدة مؤقتة للقراءة فقط
    js/ css/ ol/ proj4/     كود الواجهة والأصول

  frontend-react/
    src/                    React وطبقة الخدمات المساندة
    public/                 نسخة المصدر لصفحات الواجهة الحالية
    docs/                   هذا التوثيق الموحد
    vite.config.js          تطوير Vite وproxy
    dist/                   ناتج npm run build
```

## 2. التشغيل

### الواجهة

من `frontend-react`:

```bash
npm install
npm run dev
npm run build
npm run preview
```

- Vite يعمل عادة على المنفذ `5173`.
- مسارات `/api` و`/socket.io` في التطوير تُمرر إلى الخادم المحلي حسب `vite.config.js`.
- `public` هو مصدر الملفات الثابتة، و`dist` ناتج بناء لا يُعدّل يدويًا.

### الخادم

من مجلد `PSM` الأب:

```bash
npm install
npm start
```

يقرأ الخادم `.env`، ويتصل بقاعدتي PostgreSQL، ويشغل APIs وSocket.io ووكيل GeoServer.

## 3. بنية الواجهة

### الخريطة

الصفحة `original-index.html` تستخدم OpenLayers وProj4 وEPSG:28191. أهم الملفات:

- `main.js`: تهيئة الخريطة والموقع والأدوات الأساسية.
- `layers.js`: تعريف الطبقات ومصادرها.
- `popup.js`: النوافذ المنبثقة وبيانات المعالم.
- `search.js` و`quick-search.js` و`location-search.js`: البحث.
- `edit-core.js` و`edit-wfs.js` وملفات تحرير الخطوط والمضلعات.
- `provider-panel.js`: لوحة مزود الخدمة وتغيير الحالة والموقع.
- `mobile-tabs.js` و`mobile-tabs.css`: عرض اللوحات على الهاتف والتابلت.

### البحث بدون خريطة

الصفحة `no-map-search.html` تستخدم:

- `no-map-search.js`: الفئات والفلاتر والنتائج.
- `market-search.js`: البحث العلوي.
- `no-map-mobile.js`: الهاتف والتابلت حتى 1024px.
- `no-map-search.css`: التصميم العام وMedia Queries.

### الإدارة

- `dashboard.html`: سجلات وإحصائيات طلبات مزودي الخدمة مع فلاتر وعدّاد للسجلات المعروضة.
- `admin-users.html`: إدارة المستخدمين والأدوار وربط الخدمات.
- `admin-view-user.html`: جلسة مشاهدة مؤقتة للقراءة فقط.
- `widgets-admin.html`: إدارة مجموعات المعلومات الحية.

## 4. الخادم وواجهات API

`server.js` مسؤول عن:

- تسجيل الدخول والتسجيل وتغيير كلمات المرور والتحقق من الجلسات.
- إدارة المستخدمين من مسارات `/api/admin/*`.
- البحث والمعالم والقيم الفريدة.
- ربط مزود الخدمة وتحديث `status` والموقع.
- طلبات الخدمة والدردشة والتقييمات والإشعارات.
- إحصائيات الإدارة وWidgets.
- اتصال Socket.io للأحداث الفورية.
- GeoServer proxy.

المسارات المهمة:

```text
POST /api/auth/login
POST /api/auth/register
POST /api/auth/verify-session
GET  /api/search-features
GET  /api/get-unique-values
GET  /api/platform-stats
GET  /api/widgets-data
GET  /api/get-provider-service
POST /api/update-service-status
GET/POST /api/service-requests...
GET/POST /api/service-ratings...
GET/POST /api/admin/...
```

### مصادقة الإدارة

مسارات الإدارة تستخدم JWT في:

```text
Authorization: Bearer <admin_token>
```

لا تعتمد على حارس HTML وحده؛ الخادم يتحقق من دور المشرف وحالة الحساب.

### جلسة المشاهدة

زر العين في إدارة المستخدمين يطلب `POST /api/admin/view-session`. يصدر الخادم JWT من نوع `readonly_view` لمدة 30 دقيقة. هذا الرمز يسمح فقط بقراءة:

- بيانات الحساب.
- طلبات المستخدم أو المزود.
- رسائل الطلبات المرتبطة به.

لا يسمح الرمز بالتعديل أو الإرسال أو القبول أو الرفض أو الإلغاء، ويجب أن يبقى هذا المنع في الخادم لا في الواجهة فقط.

## 5. قاعدة البيانات

الخادم يستخدم:

- `services_db`: المستخدمون، الخدمات، الطلبات، الرسائل، التقييمات، الإشعارات وWidgets.
- `realestate`: طبقات العقارات المكانية.

المفاهيم الأساسية:

- `users`: الحساب والدور وربط مزود الخدمة.
- `service_requests`: طلبات التواصل بين المستخدم والمزود.
- `service_request_messages`: رسائل الدردشة.
- `service_ratings`: التقييمات.
- `notifications`: الإشعارات.
- `service_all`: جدول الخدمات الموحد ويستخدم `discriminator`.

### حالات الخدمة

- `status=0`: متوفر.
- `status=1`: غير متوفر.
- `auto_status`: قيمة مشتقة تستخدمها الخريطة والبحث، وقد تتأثر بالحالة وساعات العمل وتاريخ الانتهاء عبر trigger.

### الإحداثيات

- `x_coord` و`y_coord`: EPSG:28191.
- `x_global` و`y_global`: إحداثيات عالمية عند توفرها.
- الخدمات تستخدم غالبًا `id`، بينما بعض طبقات العقارات تستخدم `fid`.

لا تنفذ migration اعتمادًا على هذا الملف فقط؛ راجع `database/` و`server.js` وقاعدة البيانات الفعلية.

## 6. المعلومات الحية

`widgets-config.js` يحتوي البيانات اليدوية وإعدادات APIs. `widgets-ticker.js` يبني الشريط والبطاقات. مصادر البيانات الحالية تشمل:

- بيانات يدوية للعملات والذهب والمحروقات والنقل والمناسبات.
- Open-Meteo للطقس.
- Aladhan للصلاة والتقويم.
- `/api/widgets-data` للتهيئة والبيانات المخزنة.
- `road_barriers` و`fuel_stations` للحالة الحية للطرق والمحطات.

## 7. الصلاحيات والأمان

الأدوار الأساسية: `user` و`provider` و`admin`.

- صلاحيات الواجهة في `config.js` للعرض فقط.
- الصلاحية الحقيقية يفرضها الخادم.
- كلمات المرور تُعالج في الخادم باستخدام bcrypt حسب مسار تسجيل الدخول.
- لا تضع أسرار PostgreSQL أو JWT أو GeoServer في `public` أو `src`.
- استخدم HTTPS في الإنتاج، خصوصًا GPS وWebView.
- لا تعتبر `localStorage` مكانًا آمنًا للأسرار.

## 8. الموبايل والتطبيق الأصلي

- الخريطة: `mobile-tabs.js` و`mobile-tabs.css`.
- البحث: `no-map-mobile.js` و`no-map-search.css`.
- WebView: `mobile-app-bridge.js`.
- التطبيق الأصلي Android/iOS غير موجود داخل هذا المشروع؛ الموجود عقد تواصل جاهز.

يجب اختبار الاتجاهين، لوحة المفاتيح، GPS، الإشعارات، زر الرجوع، safe-area، الشبكة البطيئة والروابط الخارجية.

## 9. النشر

1. عدّل المصدر في `frontend-react/public` أو `src`.
2. اختبر محليًا.
3. شغّل `npm run build`.
4. انشر `dist` إذا كان النشر يعتمد نسخة React، أو انشر ملفات `public`/المجلد الذي يخدمه الخادم حسب إعداد الإنتاج.
5. شغّل الخادم من مجلد `PSM` واضبط `.env`.
6. اختبر APIs والخريطة والبحث والإدارة والموبايل.

## 10. قاعدة تحديث التوثيق

عند تغيير API أو جدول أو صلاحية أو صفحة:

- حدّث الوثيقة المتخصصة داخل `docs`.
- حدّث هذا الدليل إذا تغيرت البنية العامة.
- أضف التغيير إلى `CHANGELOG.md`.
- لا تنسخ وثائق المجلد الأب عشوائيًا؛ ادمج المعلومات بعد مطابقتها مع الكود الحالي.

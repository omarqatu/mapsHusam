# توثيق واجهات API

هذه المسارات هي عقد الاستخدام الظاهرة بين الواجهة والخادم. المصدر النهائي للتفاصيل هو `PSM/server.js`.

## المصادقة والمستخدمون

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/verify-session`
- `POST /api/auth/change-password`
- مسارات إدارة المستخدمين تحت `/api/admin`.

## البحث والبيانات

- `GET /api/search-features`
- `GET /api/get-unique-values`
- `GET /api/platform-stats`
- `GET /api/provider-linked-features`
- `GET /api/widgets-data`

## مزود الخدمة

- `GET /api/get-provider-service?user_id=...`
- `POST /api/update-service-status`

القيم اليدوية للحالة:

- `status=0`: متوفر.
- `status=1`: غير متوفر.

تحديث GPS يرسل `x_coord` و`y_coord`، بينما تغيير الحالة فقط لا يحتاج إحداثيات جديدة.

## التقييمات وطلبات الخدمة

- `GET /api/service-ratings`
- `GET /api/service-ratings/pending-comments`
- مسارات طلبات الخدمة تحت `/api/service-requests`.
- مسارات الدردشة والرسائل مرتبطة بنظام Socket.io وواجهات الخادم.

## قواعد العميل

- استخدم `response.ok` و`data.success` معًا.
- لا تعرض `details` الحساسة للمستخدم النهائي في الإنتاج.
- استخدم `URLSearchParams` للمعاملات.
- لا تضع أسرارًا أو كلمات مرور في JavaScript أو localStorage.

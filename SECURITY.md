# 🔒 دليل الأمن السيبراني - Real Estate Map System

## نظرة عامة على الأمان

تم تطبيق طبقات متعددة من الحماية لتأمين النظام من الهجمات السيبرانية ومنع الوصول غير المصرح به.

---

## ✅ التدابير الأمنية المطبقة

### 1. **Helmet.js - حماية HTTP Headers**
- **Content Security Policy (CSP)**: تقييد مصادر المحتوى المسموح بها
- **HSTS**: فرض HTTPS للاتصالات
- **XSS Protection**: حماية من هجمات XSS
- **No Sniff**: منع MIME type sniffing
- **Referrer Policy**: التحكم في معلومات referrer

### 2. **CORS Protection - تقييد المصادر**
- السماح فقط بالمصادر المحددة في متغير البيئة `ALLOWED_ORIGINS`
- رفض الطلبات من مصادر غير معروفة
- دعم الاعتمادات (credentials) للمصادر الموثوقة

### 3. **Rate Limiting - منع الهجمات**
- **عام**: 100 طلب كل 15 دقيقة لكل IP
- **تسجيل الدخول**: 5 محاولات كل 15 دقيقة
- **Socket.io**: 10 رسائل كل دقيقة لكل اتصال

### 4. **Socket.io Security**
- التحقق من Origin قبل الاتصال
- Rate limiting للرسائل
- التحقق من userId قبل ربط الاتصال
- تسجيل IP العميل لكل اتصال

### 5. **PostgreSQL Security**
- تشفير SSL للاتصالات
- حد أقصى لعدد الاتصالات (20 لكل pool)
- timeout للاتصالات (10 ثواني)
- idle timeout (30 ثانية)

### 6. **GeoServer Protection**
- **Authentication**: Basic Auth مطلوب
- **Authorization**: التحقق من user_id في header
- **Origin Check**: التحقق من مصدر الطلب
- **DELETE Block**: منع عمليات الحذف
- **IP Logging**: تسجيل IP لكل طلب

### 7. **Input Validation**
- التحقق من نوع البيانات (numbers, strings)
- التحقق من النطاق (قيم موجبة، 0 أو 1)
- التحقق من الطبقات المسموح بها (ALLOWED_LAYERS)
- Sanitization للمدخلات

### 8. **Logging & Monitoring**
- تسجيل جميع الطلبات مع IP ووقت الاستجابة
- تسجيل الأخطاء بالتفصيل
- تسجيل محاولات الوصول المرفوضة
- تسجيل اتصالات Socket.io

### 9. **Environment Variables**
- تخزين البيانات الحساسة في `.env`
- إضافة `.env` إلى `.gitignore`
- قيم افتراضية آمنة للبيئة المحلية

---

## 🔑 إعدادات البيئة

### ملف `.env` المطلوب:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
POSTGRES_HOST=your_database_host
POSTGRES_PORT=5432
POSTGRES_USER=your_database_user
POSTGRES_PASSWORD=your_secure_password
SERVICES_DB_NAME=services_db
REAL_ESTATE_DB_NAME=realestate

# GeoServer Configuration
GEOSERVER_TARGET=http://your_geoserver_host:8080/geoserver

# Security Configuration
ALLOWED_ORIGINS=http://your-domain.com,https://your-domain.com
SESSION_SECRET=your_super_secret_session_key_change_this_in_production

# Rate Limiting
API_RATE_LIMIT=100
API_RATE_WINDOW_MS=900000
AUTH_RATE_LIMIT=5
SOCKET_RATE_LIMIT=10
```

---

## 🚨 خطوات الأمان الإلزامية

### 1. **تغيير كلمات المرور الافتراضية**
```bash
# في ملف .env
POSTGRES_PASSWORD=your_strong_password_here
SESSION_SECRET=your_random_secret_key_here
```

### 2. **تكوين ALLOWED_ORIGINS**
```bash
# أضف فقط الدومينات الموثوقة
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### 3. **تأمين GeoServer**
```bash
# في GeoServer config
# تغيير كلمة مرور admin الافتراضية
# تفعيل HTTPS
# تقييد الوصول بالـ IP
```

### 4. **تأمين PostgreSQL**
```bash
# تفعيل SSL/TLS
# إنشاء مستخدمين محددين لكل قاعدة بيانات
# تقييد الوصول بالـ IP
```

---

## 📊 المراقبة والتنبيهات

### السجلات المهمة:
- 🚫 الطلبات المرفوضة (CORS, Rate Limit)
- ⚠️ محاولات تسجيل دخول فاشلة
- 🔌 اتصالات Socket.io الجديدة
- 📡 طلبات GeoServer
- ❌ الأخطاء في قاعدة البيانات

### الأدوات المقترحة:
- **PM2**: لإدارة العمليات وإعادة التشغيل التلقائي
- **Winston**: لتسجيل متقدم
- **Sentry**: لتتبع الأخطاء
- **New Relic**: لمراقبة الأداء

---

## 🛡️ أفضل الممارسات

### 1. **تحديث المكتبات بانتظام**
```bash
npm audit
npm audit fix
npm update
```

### 2. **استخدام HTTPS في الإنتاج**
```bash
# تثبيت SSL certificate
# تكوين Nginx/Apache كـ reverse proxy
```

### 3. **النسخ الاحتياطي**
- نسخ احتياطي يومي لقاعدة البيانات
- نسخ احتياطي للملفات الثابتة
- اختبار استعادة النسخ الاحتياطي

### 4. **فحص الثغرات**
```bash
npm install -g snyk
snyk test
```

---

## ⚠️ تحذيرات أمنية

### ❌ ما يجب تجنبه:
- ✗ نشر ملف `.env` في Git
- ✗ استخدام كلمات مرور ضعيفة
- ✗ السماح بـ CORS من `*`
- ✗ تعطيل Rate Limiting
- ✗ استخدام GeoServer بدون auth
- ✗ تعطيل SSL في PostgreSQL

### ✅ ما يجب فعله:
- ✓ استخدام كلمات مرور قوية
- ✓ تفعيل HTTPS
- ✓ تحديث المكتبات بانتظام
- ✓ مراقبة السجلات يومياً
- ✓ عمل نسخ احتياطي
- ✓ اختبار الأمان بانتظام

---

## 📞 في حالة الاختراق

### خطوات الطوارئ:
1. **فوراً**: قطع الاتصال بالإنترنت
2. **تغيير كلمات المرور**: جميع الحسابات
3. **مراجعة السجلات**: تحديد نقطة الاختراق
4. **إعادة التشغيل**: بعد إصلاح الثغرة
5. **إبلاغ المستخدمين**: إذا كانت بياناتهم معرضة للخطر
6. **توثيق الحادث**: للتحليل المستقبلي

---

## 🔗 روابط مفيدة

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [Socket.io Security](https://socket.io/docs/v4/security/)

---

## 📝 التغييرات الأخيرة

- **2026-07-05**: إضافة Helmet.js، Rate Limiting، CORS Protection
- **2026-07-05**: تأمين GeoServer Proxy
- **2026-07-05**: إضافة Input Validation
- **2026-07-05**: تأمين PostgreSQL Connections
- **2026-07-05**: إضافة Logging & Monitoring

---

**آخر تحديث**: 5 يوليو 2026  
**الإصدار**: 1.0.0  
**الحالة**: ✅ نشط ومحمي

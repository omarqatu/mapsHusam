# مخطط قاعدة البيانات (Database Schema)

## نظرة عامة

تستخدم منصة خريطة خدمات فلسطين PostgreSQL مع امتداد PostGIS لإدارة البيانات المكانية. يتكون النظام من قاعدتي بيانات رئيسيتين: `services_db` للبيانات المتعلقة بالخدمات و `realestate` لبيانات العقارات.

## اتصال قاعدة البيانات

### تجمعات الاتصال

#### servicesPool
- **قاعدة البيانات**: services_db
- **المضيف**: 144.91.84.168
- **المنفذ**: 5432
- **الحد الأقصى للاتصالات**: 20 (افتراضي)
- **الغرض**: طلبات الخدمة، المستخدمون، التقييمات، الإشعارات

#### realestatePool
- **قاعدة البيانات**: realestate
- **المضيف**: 144.91.84.168
- **المنفذ**: 5432
- **الحد الأقصى للاتصالات**: 20 (افتراضي)
- **الغرض**: العقارات والبيانات المكانية

## مخطط services_db

### users

حسابات المستخدمين وبيانات المصادقة.

| العمود | النوع | القيود | الوصف |
|--------|------|-------------|-------------|
| user_id | INTEGER | PRIMARY KEY | معرف المستخدم الفريد |
| full_name | VARCHAR(255) | NOT NULL | الاسم الكامل للمستخدم |
| email | VARCHAR(255) | UNIQUE | عنوان البريد الإلكتروني للمستخدم |
| phone | VARCHAR(20) | UNIQUE | رقم هاتف المستخدم |
| password | VARCHAR(255) | NOT NULL | كلمة المرور المشفرة (bcrypt) |
| role | VARCHAR(20) | NOT NULL | دور المستخدم (user, provider, admin) |
| status | VARCHAR(20) | DEFAULT 'active' | حالة الحساب |
| force_logout_flag | BOOLEAN | DEFAULT false | علامة إجبار تسجيل الخروج |
| created_at | TIMESTAMP | DEFAULT NOW() | طابع زمني لإنشاء الحساب |
| updated_at | TIMESTAMP | DEFAULT NOW() | طابع زمني لآخر تحديث |

**الفهارس**:
- PRIMARY KEY على user_id
- فهرس UNIQUE على email
- فهرس UNIQUE على phone
- فهرس على role

**العلاقات**:
- واحد إلى متعدد مع service_requests (كمستخدم)
- واحد إلى متعدد مع service_requests (كمزود)
- واحد إلى متعدد مع service_ratings
- واحد إلى متعدد مع notifications

### service_requests

سجلات طلبات الخدمة التي تتبع تفاعلات المستخدم-المزود.

| العمود | النوع | القيود | الوصف |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | معرف الطلب الفريد |
| user_id | INTEGER | NOT NULL, FK | معرف المستخدم الطالب |
| provider_user_id | INTEGER | NOT NULL, FK | معرف مستخدم المزود |
| service_layer | VARCHAR(100) | NOT NULL | اسم طبقة الخدمة |
| feature_id | INTEGER | NOT NULL | معرف الميزة في طبقة الخدمة |
| provider_name | VARCHAR(255) | NOT NULL | اسم المزود |
| service_type | VARCHAR(100) | NOT NULL | نوع الخدمة |
| status | VARCHAR(20) | NOT NULL | حالة الطلب (pending, accepted, rejected, completed, cancelled) |
| user_confirmed | BOOLEAN | DEFAULT false | تأكيد المستخدم للإتمام |
| provider_confirmed | BOOLEAN | DEFAULT false | تأكيد المزود للإتمام |
| created_at | TIMESTAMP | DEFAULT NOW() | طابع زمني لإنشاء الطلب |
| updated_at | TIMESTAMP | DEFAULT NOW() | طابع زمني لآخر تحديث |

**الفهارس**:
- PRIMARY KEY على id
- فهرس على user_id
- فهرس على provider_user_id
- فهرس على status
- فهرس مركب على (user_id, status)
- فهرس مركب على (provider_user_id, status)

**العلاقات**:
- متعدد إلى واحد مع users (كمستخدم)
- متعدد إلى واحد مع users (كمزود)
- واحد إلى متعدد مع service_request_messages
- واحد إلى متعدد مع service_ratings

### service_request_messages

رسائل المحادثة بين المستخدمين والمزودين.

| العمود | النوع | القيود | الوصف |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | معرف الرسالة الفريد |
| request_id | INTEGER | NOT NULL, FK | معرف الطلب المرتبط |
| sender_id | INTEGER | NOT NULL, FK | معرف مستخدم المرسل |
| sender_role | VARCHAR(20) | NOT NULL | دور المرسل (user, provider) |
| message | TEXT | NOT NULL | محتوى الرسالة |
| created_at | TIMESTAMP | DEFAULT NOW() | طابع زمني للرسالة |

**الفهارس**:
- PRIMARY KEY على id
- فهرس على request_id
- فهرس على sender_id
- فهرس مركب على (request_id, created_at)

**العلاقات**:
- متعدد إلى واحد مع service_requests
- متعدد إلى واحد مع users

### service_ratings

تقييمات ومراجعات المستخدمين للمزودين.

| العمود | النوع | القيود | الوصف |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | معرف التقييم الفريد |
| user_id | INTEGER | NOT NULL, FK | معرف مستخدم التقييم |
| provider_user_id | INTEGER | NOT NULL, FK | معرف المزود المُقيّم |
| request_id | INTEGER | NOT NULL, FK | معرف الطلب المرتبط |
| service_layer | VARCHAR(100) | | اسم طبقة الخدمة |
| feature_id | INTEGER | | معرف الميزة |
| rating | INTEGER | NOT NULL, CHECK(1-5) | قيمة التقييم (1-5) |
| comment | TEXT | | تعليق المستخدم |
| created_at | TIMESTAMP | DEFAULT NOW() | طابع زمني للتقييم |

**الفهارس**:
- PRIMARY KEY على id
- فهرس على user_id
- فهرس على provider_user_id
- فهرس على request_id
- فهرس فريد مركب على (user_id, request_id)

**العلاقات**:
- متعدد إلى واحد مع users (كمستخدم)
- متعدد إلى واحد مع users (كمزود)
- متعدد إلى واحد مع service_requests

### notifications

إشعارات المستخدم للأحداث المختلفة.

| العمود | النوع | القيود | الوصف |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | معرف الإشعار الفريد |
| user_id | INTEGER | NOT NULL, FK | معرف مستخدم المستلم |
| title | VARCHAR(255) | NOT NULL | عنوان الإشعار |
| message | TEXT | NOT NULL | رسالة الإشعار |
| type | VARCHAR(50) | NOT NULL | نوع الإشعار (info, success, error, warning) |
| is_read | BOOLEAN | DEFAULT false | حالة القراءة |
| created_at | TIMESTAMP | DEFAULT NOW() | طابع زمني الإنشاء |

**الفهارس**:
- PRIMARY KEY على id
- فهرس على user_id
- فهرس على is_read
- فهرس مركب على (user_id, is_read)

**العلاقات**:
- متعدد إلى واحد مع users

### map_service_stats

إحصائيات وتحليلات تفاعل الخريطة.

| العمود | النوع | القيود | الوصف |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | معرف الإحصائية الفريد |
| user_id | INTEGER | NOT NULL, FK | معرف المستخدم |
| provider | VARCHAR(255) | NOT NULL | اسم المزود |
| service | VARCHAR(100) | NOT NULL | نوع الخدمة |
| created_at | TIMESTAMP | DEFAULT NOW() | طابع زمني الإنشاء |

**الفهارس**:
- PRIMARY KEY على id
- فهرس على user_id
- فهرس على service
- فهرس مركب على (user_id, service)

**العلاقات**:
- متعدد إلى واحد مع users

### provider_success_stats

مقاييس نجاح المزود وتتبع الأداء.

| العمود | النوع | القيود | الوصف |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | معرف الإحصائية الفريد |
| provider_user_id | INTEGER | NOT NULL, FK | معرف مستخدم المزود |
| provider_name | VARCHAR(255) | NOT NULL | اسم المزود |
| service_type | VARCHAR(100) | NOT NULL | نوع الخدمة |
| total_requests | INTEGER | DEFAULT 0 | إجمالي الطلبات المستلمة |
| accepted_requests | INTEGER | DEFAULT 0 | الطلبات المقبولة |
| completed_requests | INTEGER | DEFAULT 0 | الطلبات المكتملة |
| success_rate | DECIMAL(5,2) | DEFAULT 0 | نسبة النجاح المئوية |
| created_at | TIMESTAMP | DEFAULT NOW() | طابع زمني الإنشاء |
| updated_at | TIMESTAMP | DEFAULT NOW() | طابع زمني آخر تحديث |

**الفهارس**:
- PRIMARY KEY على id
- فهرس على provider_user_id
- فهرس على service_type
- فهرس مركب على (provider_user_id, service_type)

**العلاقات**:
- متعدد إلى واحد مع users

## جداول طبقات الخدمة

لكل نوع خدمة جدول خاص به مع بيانات مكانية. البنية المشتركة:

### مثال: carpenter

| العمود | النوع | القيود | الوصف |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | معرف الميزة |
| name | VARCHAR(255) | | اسم المزود |
| phone | VARCHAR(20) | | رقم الهاتف |
| whatsapp | VARCHAR(20) | | رقم الواتساب |
| status | INTEGER | DEFAULT 0 | حالة التوفر (0=متاح، 1=مشغول) |
| x_coord | NUMERIC | | إحداثي X (EPSG:28191) |
| y_coord | NUMERIC | | إحداثي Y (EPSG:28191) |
| geom | GEOMETRY(Point,28191) | | الهندسة المكانية |

**الفهرس المكاني**:
- فهرس GIST على العمود geom

**طبقات الخدمة**:
- carpenter (نجار)
- electrician (كهربائي)
- plumber (سباك)
- painter (دهان)
- mechanic (ميكانيكي)
- taxi_on_call (تاكسي عند الطلب)
- private_tutors (مدرسون خصوصيون)
- music_training (تدريب موسيقي)
- lawyers (محامون)
- clinics (عيادات)
- programmers (مبرمجون)
- land_surveyors (مساحو الأراضي)
- student_research_assist (مساعدة بحث الطلاب)
- car_delivery_on_call (توصيل سيارات عند الطلب)
- motorcycle_delivery_on_call (توصيل دراجات نارية عند الطلب)
- bicycle_delivery_on_call (توصيل دراجات عند الطلب)
- والمزيد...

## مخطط realestate

### طبقات العقارات

جداول عقارات العقارات مع بيانات مكانية.

#### مثال: ApartRent (شقق للإيجار)

| العمود | النوع | القيود | الوصف |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | معرف العقار |
| price | NUMERIC | | سعر الإيجار |
| area | NUMERIC | | مساحة العقار (متر مربع) |
| rooms | INTEGER | | عدد الغرف |
| floor | INTEGER | | رقم الطابق |
| address | VARCHAR(255) | | عنوان العقار |
| phone | VARCHAR(20) | | هاتف الاتصال |
| x_coord | NUMERIC | | إحداثي X (EPSG:28191) |
| y_coord | NUMERIC | | إحداثي Y (EPSG:28191) |
| geom | GEOMETRY(Point,28191) | | الهندسة المكانية |

**طبقات العقارات**:
- ApartRent (شقق للإيجار)
- ApartSale (شقق للبيع)
- LandSale (أراضٍ للبيع)
- والمزيد...

## تكوين PostGIS

### نظام الإحداثيات المرجعي

- **CRS الأساسي**: EPSG:28191 (شبكة فلسطين)
- **التحويل**: Proj4 لتحويلات الإحداثيات
- **المرجع المكاني**: فلسطين 1923 / شبكة فلسطين

### الفهارس المكانية

جميع الجداول المكانية تتضمن فهارس GIST على أعمدة الهندسة:

```sql
CREATE INDEX idx_table_geom ON table_name USING GIST (geom);
```

### الاستعلامات المكانية

العمليات المكانية الشائعة:

#### استعلام BBOX
```sql
SELECT * FROM table_name 
WHERE ST_Intersects(
    geom, 
    ST_MakeEnvelope(minX, minY, maxX, maxY, 28191)
);
```

#### استعلام المسافة
```sql
SELECT * FROM table_name 
WHERE ST_DWithin(
    geom, 
    ST_SetSRID(ST_MakePoint(x, y), 28191), 
    distance
);
```

#### تحويل الإحداثيات
```sql
SELECT ST_Transform(geom, 4326) FROM table_name;
```

## قيود قاعدة البيانات

### المفاتيح الأجنبية

```sql
ALTER TABLE service_requests 
ADD CONSTRAINT fk_service_requests_user 
FOREIGN KEY (user_id) REFERENCES users(user_id);

ALTER TABLE service_requests 
ADD CONSTRAINT fk_service_requests_provider 
FOREIGN KEY (provider_user_id) REFERENCES users(user_id);
```

### قيود التحقق

```sql
ALTER TABLE service_ratings 
ADD CONSTRAINT chk_rating_range 
CHECK (rating >= 1 AND rating <= 5);
```

### القيم الافتراضية

- الطوابع الزمنية الافتراضية هي NOW()
- الحقول المنطقية الافتراضية هي false
- حقول الحالة لها افتراضات مناسبة

## مشغلات قاعدة البيانات

### مشغل التحديث في الوقت

تحديثات الطابع الزمني التلقائية:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## طرق عرض قاعدة البيانات

### عرض الميزات المرتبطة بالمزود

```sql
CREATE OR REPLACE VIEW provider_linked_features AS
SELECT 
    user_id,
    service_layer,
    feature_id
FROM users
WHERE role = 'provider' 
AND status = 'active'
AND service_layer IS NOT NULL
AND feature_id IS NOT NULL;
```

## دوال قاعدة البيانات

### دالة الحصول على الإحداثيات

```sql
CREATE OR REPLACE FUNCTION get_feature_coordinates(
    p_layer TEXT,
    p_id_field TEXT,
    p_feat_id INTEGER
)
RETURNS TABLE(x_coord NUMERIC, y_coord NUMERIC, status INTEGER) AS $$
BEGIN
    RETURN QUERY EXECUTE format(
        'SELECT x_coord, y_coord, status FROM public."%I" WHERE %I = $1',
        p_layer, p_id_field
    ) USING p_feat_id;
END;
$$ LANGUAGE plpgsql;
```

## صيانة قاعدة البيانات

### استراتيجية النسخ الاحتياطي

- نسخ احتياطي آلي منتظم
- قدرة الاسترداد في نقطة زمنية
- سياسة الاحتفاظ بالنسخ الاحتياطي

### صيانة الفهرس

- إعادة بناء الفهرس المنتظم
- تحديثات الإحصائيات
- مراقبة الأداء

### Vacuum و Analyze

```sql
VACUUM ANALYZE;
```

## اعتبارات الأمان

### أمان قاعدة البيانات

- الاتصال عبر SSL (موصى به للإنتاج)
- سياسات كلمات مرور قوية
- تحديثات أمنية منتظمة
- أذونات مستخدم محدودة

### خصوصية البيانات

- تشفير البيانات الحساسة
- تسجيل الوصول
- سياسات الاحتفاظ بالبيانات

## تحسين الأداء

### تحسين الاستعلام

- استراتيجية فهرسة مناسبة
- تحليل خطة الاستعلام
- تجمع الاتصال
- العبارات المحضرة

### الأداء المكاني

- فهارس GIST على جميع أعمدة الهندسة
- التجميع المكاني
- تحسين استعلام BBOX
- اتساق نظام الإحداثيات

## استراتيجية الترحيل

### إصدار المخطط

- تغييرات المخطط الخاضعة للتحكم في الإصدار
- نصوص الترحيل
- إجراءات التراجع

### ترحيل البيانات

- استيراد البيانات القديمة
- التحقق من صحة البيانات
- نصوص التحويل

---

**آخر تحديث**: 29 يوليو 2026  
**الإصدار**: 1.0.0  
**الصيانة بواسطة**: فريق التطوير

# معايير البرمجة (Coding Standards)

## نظرة عامة

يحدد هذا المستند معايير البرمجة وأفضل الممارسات لمنصة خريطة خدمات فلسطين. اتباع هذه المعايير يضمن اتساق الكود، قابلية الصيانة، والجودة عبر المشروع.

## المبادئ العامة

### جودة الكود

1. **القابلية للقراءة أولاً**: يجب أن يكون الكود سهل القراءة والفهم
2. **الاتساق**: اتبع الأنماط المتسقة عبر قاعدة الكود
3. **البساطة**: ابق الكود بسيطاً ومباشراً
4. **مبدأ DRY**: لا تكرر نفسك - أعد استخدام الكود
5. **مبدأ KISS**: ابق الأمر بسيطاً يا غبي

### التوثيق

1. **علق المنطق المعقد**: أضف تعليقات للعمليات المعقدة
2. **وثق الدوال**: استخدم JSDoc لتوثيق الدوال
3. **تحديث التعليقات**: أبق التعليقات متزامنة مع الكود
4. **تجنب التعليقات الواضحة**: لا تعلق على الكود الواضح بذاته

## معايير JavaScript

### اتفاقيات التسمية

#### المتغيرات والدوال

```javascript
// ✅ جيد: camelCase
const userName = 'John';
const getUserById = (id) => { };

// ❌ سيء: حالة غير متسقة
const user_name = 'John';
const GetUserId = (id) => { };
```

#### الثوابت

```javascript
// ✅ جيد: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 5242880;
const API_RATE_LIMIT = 100;

// ❌ سيء: حالة غير متسقة
const maxFileSize = 5242880;
const ApiRateLimit = 100;
```

#### الفئات

```javascript
// ✅ جيد: PascalCase
class UserService { }
class MapComponent { }

// ❌ سيء: حالة غير متسقة
class userService { }
class map_component { }
```

#### الأعضاء الخاصون

```javascript
// ✅ جيد: بادئة شرطة سفلية
class UserService {
    #privateField; // حقل خاص
    _internalMethod() { } // طريقة داخلية
}

// ❌ سيء: لا يوجد إشارة للخصوصية
class UserService {
    privateField;
    internalMethod() { }
}
```

### بنية الكود

#### إعلان الدالة

```javascript
// ✅ جيد: async/await مع معالجة الأخطاء
async function getUserById(userId) {
    try {
        const result = await servicesPool.query(
            'SELECT * FROM users WHERE user_id = $1',
            [userId]
        );
        return result.rows[0];
    } catch (error) {
        console.error('فشل في جلب المستخدم:', error);
        throw error;
    }
}

// ❌ سيء: لا يوجد معالجة للأخطاء
async function getUserById(userId) {
    const result = await servicesPool.query(
        'SELECT * FROM users WHERE user_id = $1',
        [userId]
    );
    return result.rows[0];
}
```

#### دوال السهم

```javascript
// ✅ جيد: استخدم دوال السهم لردود النداء
const filteredUsers = users.filter(user => user.active);
const doubled = numbers.map(n => n * 2);

// ❌ سيء: دوال سهم غير ضرورية
const getUserById = async (userId) => { };
```

#### تفكيك الكائن

```javascript
// ✅ جيد: التفكيك للوضوح
const { user_id, full_name, email } = user;

// ❌ سيء: الوصول المباشر للخصائص
const userId = user.user_id;
const fullName = user.full_name;
const email = user.email;
```

### معالجة الأخطاء

```javascript
// ✅ جيد: معالجة أخطاء محددة
try {
    await someOperation();
} catch (error) {
    if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
    } else if (error instanceof DatabaseError) {
        return res.status(500).json({ error: 'خطأ في قاعدة البيانات' });
    }
    throw error;
}

// ❌ سيء: معالجة أخطاء عامة
try {
    await someOperation();
} catch (error) {
    console.error(error);
}
```

### Async/Await

```javascript
// ✅ جيد: استخدم async/await
async function processData() {
    const data = await fetchData();
    const processed = await transformData(data);
    return processed;
}

// ❌ سيء: وعود متداخلة
function processData() {
    return fetchData().then(data => {
        return transformData(data);
    });
}
```

## معايير React

### بنية المكون

```javascript
// ✅ جيد: بنية مكون منظمة
function MapComponent({ layers, onLayerChange }) {
    // الخطافات
    const [map, setMap] = useState(null);
    const [activeLayer, setActiveLayer] = useState(null);
    
    // التأثيرات
    useEffect(() => {
        const mapInstance = initMap();
        setMap(mapInstance);
        return () => mapInstance.setTarget(null);
    }, []);
    
    // المعالجات
    const handleLayerClick = (layer) => {
        setActiveLayer(layer);
        onLayerChange(layer);
    };
    
    // العرض
    return (
        <div className="map-container">
            {layers.map(layer => (
                <Layer
                    key={layer.id}
                    layer={layer}
                    onClick={handleLayerClick}
                />
            ))}
        </div>
    );
}

// ❌ سيء: مكون غير منظم
function MapComponent({ layers, onLayerChange }) {
    const [map, setMap] = useState(null);
    const handleLayerClick = (layer) => {
        setActiveLayer(layer);
        onLayerChange(layer);
    };
    const [activeLayer, setActiveLayer] = useState(null);
    useEffect(() => {
        const mapInstance = initMap();
        setMap(mapInstance);
        return () => mapInstance.setTarget(null);
    }, []);
    return (
        <div className="map-container">
            {layers.map(layer => (
                <Layer key={layer.id} layer={layer} onClick={handleLayerClick} />
            ))}
        </div>
    );
}
```

### تفكيك الخصائص

```javascript
// ✅ جيد: تفكيك الخصائص
function UserProfile({ user, onUpdate, onDelete }) {
    const { name, email, phone } = user;
    // ...
}

// ❌ سيء: الوصول المباشر للخصائص
function UserProfile(props) {
    const name = props.user.name;
    const email = props.user.email;
    const phone = props.user.phone;
    // ...
}
```

### الخطافات المخصصة

```javascript
// ✅ جيد: خطاف مخصص للمنطق القابل لإعادة الاستخدام
function useServiceRequests(userId) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        async function fetchRequests() {
            setLoading(true);
            try {
                const data = await fetchServiceRequests(userId);
                setRequests(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        
        fetchRequests();
    }, [userId]);
    
    return { requests, loading, error };
}
```

## معايير SQL

### تنسيق الاستعلام

```sql
-- ✅ جيد: استعلام منسق
SELECT 
    u.user_id,
    u.full_name,
    u.email,
    COUNT(sr.id) as request_count
FROM users u
LEFT JOIN service_requests sr ON u.user_id = sr.user_id
WHERE u.role = 'user'
    AND u.status = 'active'
GROUP BY u.user_id, u.full_name, u.email
ORDER BY request_count DESC
LIMIT 10;

-- ❌ سيء: استعلام غير منسق
SELECT u.user_id, u.full_name, u.email, COUNT(sr.id) as request_count FROM users u LEFT JOIN service_requests sr ON u.user_id = sr.user_id WHERE u.role = 'user' AND u.status = 'active' GROUP BY u.user_id, u.full_name, u.email ORDER BY request_count DESC LIMIT 10;
```

### الاستعلامات المُعَلَّمة

```javascript
// ✅ جيد: استعلام مُعَلَّم
await servicesPool.query(
    'SELECT * FROM users WHERE user_id = $1 AND email = $2',
    [userId, email]
);

// ❌ سيء: سلسلة نصية متسلسلة (خطر حقن SQL)
await servicesPool.query(
    `SELECT * FROM users WHERE user_id = ${userId} AND email = '${email}'`
);
```

### اتفاقيات التسمية

```sql
-- ✅ جيد: snake_case للجداول والأعمدة
CREATE TABLE service_requests (
    request_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    provider_user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ❌ سيء: تسمية غير متسقة
CREATE TABLE ServiceRequests (
    RequestID SERIAL PRIMARY KEY,
    UserID INTEGER NOT NULL,
    ProviderUserID INTEGER NOT NULL,
    CreatedAt TIMESTAMP DEFAULT NOW()
);
```

## معايير CSS

### تسمية الفئات

```css
/* ✅ جيد: اتفاقية تسمية BEM */
.map__container {
    width: 100%;
    height: 100vh;
}

.map__layer--active {
    opacity: 1;
}

.chat__message {
    padding: 10px;
}

.chat__message--sent {
    background-color: #007bff;
}

/* ❌ سيء: تسمية غير متسقة */
.mapContainer {
    width: 100%;
}

.active-layer {
    opacity: 1;
}

.message {
    padding: 10px;
}
```

### التنظيم

```css
/* ✅ جيد: منظم حسب المكون */
/* أنماط الخريطة */
.map__container { }
.map__layer { }

/* أنماط المحادثة */
.chat__container { }
.chat__message { }

/* أنماط الإشعارات */
.notification__banner { }
.notification__message { }

/* ❌ سيء: غير منظم */
.map__container { }
.chat__message { }
.notification__banner { }
.map__layer { }
```

## تنظيم الملفات

### هيكل الدليل

```
project/
├── docs/                  # التوثيق
├── js/                    # وحدات JavaScript
│   ├── auth.js           # المصادقة
│   ├── api.js            # استدعاءات API
│   └── utils.js          # الأدوات المساعدة
├── css/                   # أوراق الأنماط
│   ├── main.css          # الأنماط الرئيسية
│   └── components.css    # أنماط المكونات
├── icons/                 # الأيقونات
└── index.html            # نقطة الدخول
```

### تسمية الملفات

```javascript
// ✅ جيد: kebab-case للملفات
// user-service.js
// map-component.js
// api-client.js

// ❌ سيء: تسمية غير متسقة
// userService.js
// MapComponent.js
// api_client.js
```

## معايير Git

### رسائل الالتزام

```bash
# ✅ جيد: رسائل التزام وصفية
git commit -m "feat: إضافة نقطة نهاية تسجيل المستخدم"
git commit -m "fix: حل مشكلة مهلة اتصال قاعدة البيانات"
git commit -m "docs: تحديث توثيق API"
git commit -m "refactor: تبسيط معالجة الأخطاء"

# ❌ سيء: رسائل التزام غامضة
git commit -m "تحديث الكود"
git commit -m "إصلاح الخطأ"
git commit -m "تغييرات"
```

### تسمية الفروع

```bash
# ✅ جيد: أسماء الفروع الوصفية
feature/add-user-registration
fix/database-connection-timeout
docs/update-api-documentation
refactor/simplify-error-handling

# ❌ سيء: أسماء الفروع الغامضة
feature/new
fix/bug
docs/update
```

## قائمة مراجعة الكود

### قبل إرسال الكود

- [ ] الكود يتبع اتفاقيات التسمية
- [ ] الدوال موثقة بشكل صحيح
- [ ] معالجة الأخطاء مطبقة
- [ ] لا توجد عبارات console.log في كود الإنتاج
- [ ] الكود منسق بشكل صحيح
- [ ] الاختبارات مشمولة
- [ ] التوثيق محدث
- [ ] لا توجد بيانات حساسة ملتزم بها
- [ ] الكود فعال وأداء عالي
- [ ] أفضل ممارسات الأمان متبعة

### معايير المراجعة

1. **الوظيفة**: هل يعمل الكود كما هو مقصود؟
2. **القابلية للقراءة**: هل الكود سهل الفهم؟
3. **قابلية الصيانة**: هل يمكن صيانة الكود بسهولة؟
4. **الأداء**: هل الكود فعال؟
5. **الأمان**: هل هناك أي ثغرات أمنية؟
6. **الاختبار**: هل الاختبارات كافية؟
7. **التوثيق**: هل الكود موثق بشكل صحيح؟

## أفضل الممارسات

### الأداء

1. **تجنب الحسابات غير الضرورية**: تخزين النتائج مؤقتاً عند الإمكان
2. **استخدم خوارزميات فعالة**: اختر هياكل البيانات المناسبة
3. **قلل التلاعب بـ DOM**: دمج تحديثات DOM
4. **تحميل كسول للموارد**: قم بتحميل الموارد فقط عند الحاجة
5. **حسّن استعلامات قاعدة البيانات**: استخدم الفهارس والاستعلامات الصحيحة

### الأمان

1. **تحقق من صحة جميع المدخلات**: لا تثق أبداً بإدخال المستخدم
2. **استخدم الاستعلامات المُعَلَّمة**: منع حقن SQL
3. **نظف المخرجات**: منع هجمات XSS
4. **استخدم HTTPS**: تشفير البيانات أثناء النقل
5. **نفذ تحديد المعدل**: منع الإساءة

### إمكانية الوصول

1. **استخدم HTML دلالي**: استخدم عناصر HTML المناسبة
2. **أضف تسميات ARIA**: تحسين دعم قارئ الشاشة
3. **تأكد من التنقل بلوحة المفاتيح**: اجعل الميزات قابلة للوصول بلوحة المفاتيح
4. **وفر نص بديل**: أضف نص بديل للصور
5. **حافظ على تباين الألوان**: تأكد من التباين الكافي

## الأدوات والمدققات

### تكوين ESLint

```javascript
// .eslintrc.js
module.exports = {
    env: {
        browser: true,
        node: true,
        es6: true
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    rules: {
        'indent': ['error', 4],
        'linebreak-style': ['error', 'unix'],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'no-unused-vars': 'warn',
        'no-console': 'off'
    }
};
```

### تكوين Prettier

```javascript
// .prettierrc
{
    "singleQuote": true,
    "tabWidth": 4,
    "trailingComma": "es5",
    "semi": true,
    "printWidth": 80
}
```

## تنسيق الكود

### المسافة البادئة

```javascript
// ✅ جيد: مسافة بادئة 4 مسافات
function processData(data) {
    if (data) {
        const result = data.map(item => {
            return item.value * 2;
        });
        return result;
    }
    return [];
}

// ❌ سيء: مسافة بادئة غير متسقة
function processData(data) {
if (data) {
const result = data.map(item => {
return item.value * 2;
});
return result;
}
return [];
}
```

### طول السطر

```javascript
// ✅ جيد: طول سطر معقول
const result = await servicesPool.query(
    'SELECT * FROM users WHERE user_id = $1',
    [userId]
);

// ❌ سيء: أسطر طويلة بشكل مفرط
const result = await servicesPool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
```

## معايير التوثيق

### تعليقات JSDoc

```javascript
/**
 * يجلب مستخدم حسب المعرف
 * @param {number} userId - معرف المستخدم
 * @returns {Promise<Object>} كائن المستخدم
 * @throws {Error} إذا لم يتم العثور على المستخدم
 */
async function getUserById(userId) {
    const result = await servicesPool.query(
        'SELECT * FROM users WHERE user_id = $1',
        [userId]
    );
    
    if (result.rows.length === 0) {
        throw new Error('المستخدم غير موجود');
    }
    
    return result.rows[0];
}
```

### التعليقات المضمنة

```javascript
// ✅ جيد: اشرح لماذا، لا ماذا
// استخدم البحث الثنائي لأداء O(log n)
const index = binarySearch(array, target);

// ❌ سيء: تعليقات واضحة
// احصل على الفهرس
const index = binarySearch(array, target);
```

---

**آخر تحديث**: 29 يوليو 2026  
**الإصدار**: 1.0.0  
**الصيانة بواسطة**: فريق التطوير

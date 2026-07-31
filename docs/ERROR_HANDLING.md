# دليل معالجة الأخطاء (Error Handling Guide)

## نظرة عامة

يقدم هذا المستند إرشادات شاملة لتنفيذ معالجة الأخطاء في منصة خريطة خدمات فلسطين. يغطي أنواع الأخطاء، استراتيجيات المعالجة، تسجيل الأخطاء، والتواصل مع المستخدم.

## أنواع الأخطاء

### أكواد حالة HTTP

#### أكواد النجاح

- **200 OK**: نجح الطلب
- **201 Created**: تم إنشاء المورد بنجاح
- **204 No Content**: نجح الطلب بدون محتوى

#### أكواد أخطاء العميل

- **400 Bad Request**: بيانات طلب غير صالحة
- **401 Unauthorized**: مطلوب مصادقة أو فشلت
- **403 Forbidden**: أذونات غير كافية
- **404 Not Found**: المورد غير موجود
- **409 Conflict**: تضارب الموارد (مكرر، إلخ)
- **422 Unprocessable Entity**: أخطاء دلالية
- **429 Too Many Requests**: تجاوز حد المعدل

#### أكواد أخطاء الخادم

- **500 Internal Server Error**: خطأ خادم غير متوقع
- **502 Bad Gateway**: استجابة غير صالحة من المنبع
- **503 Service Unavailable**: الخدمة غير متاحة مؤقتاً
- **504 Gateway Timeout**: مهلة المنبع

### أخطاء التطبيق

#### أخطاء التحقق من الصحة

```javascript
class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.statusCode = 400;
    }
}
```

#### أخطاء المصادقة

```javascript
class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
        this.statusCode = 401;
    }
}
```

#### أخطاء التفويض

```javascript
class AuthorizationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthorizationError';
        this.statusCode = 403;
    }
}
```

#### أخطاء قاعدة البيانات

```javascript
class DatabaseError extends Error {
    constructor(message, originalError) {
        super(message);
        this.name = 'DatabaseError';
        this.statusCode = 500;
        this.originalError = originalError;
    }
}
```

## أنماط معالجة الأخطاء

### نمط Try-Catch

```javascript
async function handleRequest(req, res) {
    try {
        // التحقق من صحة الإدخال
        const { param1, param2 } = req.body;
        if (!param1) {
            throw new ValidationError('param1 مطلوب', 'param1');
        }
        
        // تنفيذ المنطق التجاري
        const result = await someOperation(param1, param2);
        
        // إرجاع النجاح
        res.json({ success: true, data: result });
    } catch (error) {
        handleError(error, req, res);
    }
}
```

### دالة معالج الأخطاء

```javascript
function handleError(error, req, res) {
    // تسجيل الخطأ
    console.error('خطأ:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        user_id: req.user?.user_id
    });
    
    // تحديد رمز الحالة
    const statusCode = error.statusCode || 500;
    
    // تحضير استجابة الخطأ
    const errorResponse = {
        success: false,
        error: error.message || 'خطأ في الخادم الداخلي'
    };
    
    // إضافة تفاصيل في التطوير
    if (process.env.NODE_ENV === 'development') {
        errorResponse.details = error.stack;
        errorResponse.originalError = error.originalError?.message;
    }
    
    // إرسال الاستجابة
    res.status(statusCode).json(errorResponse);
}
```

### معالج الأخطاء العام

```javascript
app.use((err, req, res, next) => {
    // معالجة أخطاء تحليل JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ 
            success: false, 
            error: 'JSON غير صالح في نص الطلب' 
        });
    }
    
    // معالجة الأخطاء الأخرى
    handleError(err, req, res);
});
```

### معالج 404

```javascript
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'نقطة النهاية غير موجودة' 
    });
});
```

## معالجة أخطاء قاعدة البيانات

### أخطاء الاتصال

```javascript
async function executeQuery(query, params) {
    try {
        const result = await servicesPool.query(query, params);
        return result;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            throw new DatabaseError('تم رفض اتصال قاعدة البيانات', error);
        } else if (error.code === 'ETIMEDOUT') {
            throw new DatabaseError('مهلة اتصال قاعدة البيانات', error);
        } else {
            throw new DatabaseError('فشل استعلام قاعدة البيانات', error);
        }
    }
}
```

### أخطاء الاستعلام

```javascript
async function getUserById(userId) {
    try {
        const result = await servicesPool.query(
            'SELECT * FROM users WHERE user_id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            throw new NotFoundError('المستخدم غير موجود');
        }
        
        return result.rows[0];
    } catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        throw new DatabaseError('فشل في جلب المستخدم', error);
    }
}
```

### أخطاء المعاملة

```javascript
async function executeTransaction(operations) {
    const client = await servicesPool.connect();
    
    try {
        await client.query('BEGIN');
        
        for (const operation of operations) {
            await operation(client);
        }
        
        await client.query('COMMIT');
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        throw new DatabaseError('فشلت المعاملة', error);
    } finally {
        client.release();
    }
}
```

## معالجة أخطاء واجهة برمجة التطبيقات

### التحقق من صحة الإدخال

```javascript
function validateRequest(schema) {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        
        if (error) {
            const details = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            
            return res.status(400).json({
                success: false,
                error: 'فشل التحقق من الصحة',
                details
            });
        }
        
        next();
    };
}
```

### معالجة أخطاء المصادقة

```javascript
function requireAuth(req, res, next) {
    const token = req.headers['authorization'];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'مطلوب مصادقة'
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'رمز غير صالح أو منتهي الصلاحية'
        });
    }
}
```

### معالجة أخطاء التفويض

```javascript
function requireRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({
                success: false,
                error: 'أذونات غير كافية'
            });
        }
        next();
    };
}
```

## معالجة أخطاء الواجهة الأمامية

### معالجة أخطاء واجهة برمجة التطبيقات

```javascript
async function fetchServiceRequests(userId) {
    try {
        const response = await fetch(`/api/service-requests?user_id=${userId}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new APIError(data.error || 'فشل الطلب', response.status);
        }
        
        if (!data.success) {
            throw new APIError(data.error || 'فشلت العملية', response.status);
        }
        
        return data.requests;
    } catch (error) {
        console.error('فشل في جلب الطلبات:', error);
        throw error;
    }
}
```

### معالجة أخطاء Socket.io

```javascript
socket.on('connect_error', (error) => {
    console.error('خطأ اتصال المقبس:', error);
    showErrorMessage('فشل الاتصال. يرجى المحاولة مرة أخرى.');
});

socket.on('error', (error) => {
    console.error('خطأ المقبس:', error);
    showErrorMessage('حدث خطأ. يرجى المحاولة مرة أخرى.');
});
```

### رسائل خطأ المستخدم

```javascript
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}
```

## تسجيل الأخطاء

### تسجيل الأخطاء المنظم

```javascript
function logError(error, context = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...context
    };
    
    console.error(JSON.stringify(logEntry));
    
    // إرسال إلى خدمة تتبع الأخطاء
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(error, { extra: context });
    }
}
```

### سياق الخطأ

```javascript
try {
    const result = await someOperation();
} catch (error) {
    logError(error, {
        operation: 'someOperation',
        user_id: req.user?.user_id,
        request_id: req.id,
        params: req.params,
        body: req.body
    });
    
    handleError(error, req, res);
}
```

## استعادة الخطأ

### منطق إعادة المحاولة

```javascript
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries) {
                console.log(`محاولة إعادة ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }
    
    throw lastError;
}
```

### منطق الاحتياطي

```javascript
async function getDataWithFallback(primary, fallback) {
    try {
        return await primary();
    } catch (error) {
        console.warn('فشلت العملية الأساسية، استخدام الاحتياطي:', error.message);
        return await fallback();
    }
}
```

## منع الأخطاء

### التحقق من صحة الإدخال

```javascript
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ValidationError('تنسيق البريد الإلكتروني غير صالح', 'email');
    }
}

function validatePhone(phone) {
    const phoneRegex = /^05[0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
        throw new ValidationError('تنسيق الهاتف غير صالح', 'phone');
    }
}
```

### فحوصات Null

```javascript
function safeGet(obj, path, defaultValue = null) {
    const value = path.split('.').reduce((acc, key) => acc?.[key], obj);
    return value !== undefined ? value : defaultValue;
}

// الاستخدام
const userName = safeGet(user, 'profile.name', 'غير معروف');
```

### فحص النوع

```javascript
function assertType(value, expectedType, fieldName) {
    if (typeof value !== expectedType) {
        throw new ValidationError(
            `${fieldName} يجب أن يكون ${expectedType}`,
            fieldName
        );
    }
}

// الاستخدام
assertType(userId, 'number', 'user_id');
```

## تواصل الخطأ

### رسائل سهلة للمستخدم

```javascript
const errorMessages = {
    'ValidationError': 'يرجى التحقق من إدخالك والمحاولة مرة أخرى.',
    'AuthenticationError': 'يرجى تسجيل الدخول والمحاولة مرة أخرى.',
    'AuthorizationError': 'ليس لديك إذن لتنفيذ هذا الإجراء.',
    'NotFoundError': 'المورد المطلوب غير موجود.',
    'DatabaseError': 'حدث خطأ في قاعدة البيانات. يرجى المحاولة مرة أخرى.',
    'NetworkError': 'خطأ في الشبكة. يرجى التحقق من اتصالك.',
    'default': 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'
};

function getUserMessage(error) {
    return errorMessages[error.name] || errorMessages.default;
}
```

### تنسيق استجابة الخطأ

```javascript
{
    "success": false,
    "error": "رسالة خطأ للمستخدم",
    "code": "ERROR_CODE",
    "details": {
        "field": "field_name",
        "value": "invalid_value"
    }
}
```

## أفضل الممارسات

### عام

1. **عالج الأخطاء دائماً**: لا تدع الأخطاء تنتشر بدون معالجة
2. **قدم سياقاً**: قم بتضمين السياق ذي الصلة في سجلات الأخطاء
3. **استخدم أكواد الحالة المناسبة**: طابق أكواد حالة HTTP مع أنواع الأخطاء
4. **سجل الأخطاء**: قم دائماً بتسجيل الأخطاء لتصحيحها
5. **رسائل خطأ آمنة**: لا تكشف عن معلومات حساسة

### الواجهة الخلفية

1. **استخدم try-catch**: قم بتغليف العمليات غير المتزامنة في try-catch
2. **تحقق من صحة الإدخال**: تحقق من صحة جميع مدخلات المستخدم
3. **عالج أخطاء قاعدة البيانات**: التقط وعالج أخطاء قاعدة البيانات
4. **استخدم فئات الأخطاء**: أنشئ فئات أخطاء مخصصة
5. **نفذ إعادة المحاولة**: أعد محاولة الفشل العابر

### الواجهة الأمامية

1. **عالج أخطاء واجهة برمجة التطبيقات**: التقط وعالج أخطاء واجهة برمجة التطبيقات
2. **أظهر ملاحظات المستخدم**: اعرض رسائل الخطأ للمستخدمين
3. **نفذ إعادة المحاولة**: أعد محاولة الطلبات الفاشلة
4. **سجل أخطاء العميل**: سجل أخطاء جانب العميل
5. **قدم خيارات الاستعادة**: اسمح للمستخدمين بإعادة محاولة الإجراءات

## استكشاف الأخطاء وإصلاحها

### أنماط الأخطاء الشائعة

#### أخطاء اتصال قاعدة البيانات

**الأعراض**: ECONNREFUSED، ETIMEDOUT

**الحلول**:
1. تحقق من تشغيل خادم قاعدة البيانات
2. تحقق من بيانات اعتماد الاتصال
3. تحقق من اتصال الشبكة
4. تحقق من أن قاعدة البيانات تقبل الاتصالات

#### أخطاء التحقق من الصحة

**الأعراض**: 400 Bad Request

**الحلول**:
1. تحقق من صحة الإدخال قبل الإرسال
2. تحقق من الحقول المطلوبة
3. تحقق من تنسيقات البيانات
4. راجع تفاصيل الخطأ

#### أخطاء المصادقة

**الأعراض**: 401 Unauthorized

**الحلول**:
1. تحقق من صحة الرمز
2. تحقق من انتهاء صلاحية الرمز
3. تحقق من بيانات الاعتماد
4. أعيد المصادقة إذا لزم الأمر

#### أخطاء التفويض

**الأعراض**: 403 Forbidden

**الحلول**:
1. تحقق من أذونات المستخدم
2. تحقق من تعيينات الأدوار
3. راجع التحكم في الوصول
4. اتصل بالمسؤول إذا لزم الأمر

---

**آخر تحديث**: 29 يوليو 2026  
**الإصدار**: 1.0.0  
**الصيانة بواسطة**: فريق التطوير

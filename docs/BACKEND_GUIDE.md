# دليل الواجهة الخلفية (Backend Guide)

## نظرة عامة

يقدم هذا المستند إرشادات شاملة لتطوير وصيانة الواجهة الخلفية لمنصة خريطة خدمات فلسطين. يغطي بنية الخادم، تطوير واجهة برمجة التطبيقات، عمليات قاعدة البيانات، وأفضل الممارسات.

## بنية الواجهة الخلفية

### مكدس التقنيات

- **بيئة التشغيل**: Node.js
- **الإطار**: Express.js
- **قاعدة البيانات**: PostgreSQL مع PostGIS
- **الاتصال في الوقت الفعلي**: Socket.io
- **المصادقة**: JWT + bcrypt
- **الأمان**: Helmet.js، CORS، تحديد المعدل

### هيكل المشروع

```
server.js (نقطة الدخول الرئيسية)
├── التكوين
│   ├── متغيرات البيئة
│   ├── اتصالات قاعدة البيانات
│   └── إعداد Socket.io
├── البرمجيات الوسيطة (Middleware)
│   ├── الأمان (Helmet)
│   ├── CORS
│   ├── تحديد المعدل
│   ├── محلل النص (Body parser)
│   └── معالج الأخطاء
├── مسارات واجهة برمجة التطبيقات
│   ├── المصادقة (/api/auth/*)
│   ├── طلبات الخدمة (/api/service-requests/*)
│   ├── المستخدمون (/api/users, /api/admin/users)
│   ├── الإحصائيات (/api/stats-*)
│   ├── نظم المعلومات الجغرافية (/api/search-features, /api/get-coordinates)
│   └── التقييمات (/api/service-ratings/*)
├── أحداث Socket.io
│   ├── connection
│   ├── disconnect
│   ├── service_request_new
│   ├── service_request_response
│   └── service_request_message
└── مسارات الوكيل
    └── /geoserver-proxy/* → GeoServer
```

## تكوين الخادم

### إعداد البيئة

#### متغيرات البيئة

```javascript
const PORT = process.env.PORT || 3000;
const PG_HOST = process.env.POSTGRES_HOST || '144.91.84.168';
const PG_PORT = Number(process.env.POSTGRES_PORT || 5432);
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
```

#### اتصالات قاعدة البيانات

```javascript
const { Pool } = require('pg');

// تجمع قاعدة بيانات الخدمات
const servicesPool = new Pool({
    host: PG_HOST,
    port: PG_PORT,
    database: process.env.SERVICES_DB_NAME || 'services_db',
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    max: 20,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
});

// تجمع قاعدة بيانات العقارات
const realestatePool = new Pool({
    host: PG_HOST,
    port: PG_PORT,
    database: process.env.REAL_ESTATE_DB_NAME || 'realestate',
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    max: 20,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
});
```

### تكوين Socket.io

```javascript
const { Server } = require('socket.io');

const io = new Server(server, {
    cors: {
        origin: corsOriginCheck,
        credentials: true
    },
    maxHttpBufferSize: 1e6 // 1MB
});

// تخزين المستخدمين المتصلين
const connectedUsers = new Map();

io.on('connection', (socket) => {
    const userId = socket.handshake.query.user_id;
    connectedUsers.set(userId, socket.id);
    
    socket.on('disconnect', () => {
        connectedUsers.delete(userId);
    });
});

global.io = io;
```

## تطوير واجهة برمجة التطبيقات

### بنية المسار

#### قالب المسار الأساسي

```javascript
app.get('/api/endpoint', async (req, res) => {
    try {
        // التحقق من صحة الإدخال
        const { param1, param2 } = req.query;
        if (!param1) {
            return res.status(400).json({ 
                success: false, 
                error: 'param1 مطلوب' 
            });
        }
        
        // تنفيذ منطق الأعمال
        const result = await someOperation(param1, param2);
        
        // إرجاع الاستجابة
        res.json({ 
            success: true, 
            data: result 
        });
    } catch (error) {
        console.error('خطأ:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'خطأ في الخادم الداخلي',
            details: error.message 
        });
    }
});
```

#### قالب المسار المحمي

```javascript
// برمجية وسيطة للمصادقة
function requireAuth(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: 'المصادقة مطلوبة' 
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            error: 'رمز غير صالح' 
        });
    }
}

// مسار محمي
app.get('/api/protected', requireAuth, async (req, res) => {
    // الوصول إلى المستخدم المصادق عبر req.user
    const userId = req.user.user_id;
    // ...
});
```

#### قالب مسار المسؤول

```javascript
function requireAdmin(req, res, next) {
    const adminUserId = req.headers['x-admin-user-id'];
    if (!adminUserId) {
        return res.status(403).json({ 
            success: false, 
            error: 'وصول المسؤول مطلوب' 
        });
    }
    
    servicesPool.query(
        'SELECT role FROM users WHERE user_id = $1',
        [adminUserId],
        (err, result) => {
            if (err || result.rows[0]?.role !== 'admin') {
                return res.status(403).json({ 
                    success: false, 
                    error: 'غير مصرح به كمسؤول' 
                });
            }
            next();
        }
    );
}

app.get('/api/admin/endpoint', requireAdmin, async (req, res) => {
    // منطق خاص بالمسؤول فقط
});
```

### عمليات قاعدة البيانات

#### قوالب الاستعلام

```javascript
// استعلام بسيط
async function getUserById(userId) {
    const result = await servicesPool.query(
        'SELECT * FROM users WHERE user_id = $1',
        [userId]
    );
    return result.rows[0];
}

// استعلام بمعاملات متعددة
async function getServiceRequests(userId, status) {
    const result = await servicesPool.query(
        'SELECT * FROM service_requests WHERE user_id = $1 AND status = $2',
        [userId, status]
    );
    return result.rows;
}

// عملية إدراج
async function createUser(userData) {
    const result = await servicesPool.query(
        `INSERT INTO users (full_name, email, phone, password, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING user_id, full_name, email, phone, role`,
        [userData.full_name, userData.email, userData.phone, 
         userData.password, userData.role]
    );
    return result.rows[0];
}

// عملية تحديث
async function updateUserStatus(userId, status) {
    const result = await servicesPool.query(
        'UPDATE users SET status = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
        [status, userId]
    );
    return result.rows[0];
}

// عملية حذف
async function deleteUser(userId) {
    const result = await servicesPool.query(
        'DELETE FROM users WHERE user_id = $2 RETURNING user_id',
        [userId]
    );
    return result.rows[0];
}
```

#### معالجة المعاملات

```javascript
async function transferData(fromId, toId, amount) {
    const client = await servicesPool.connect();
    
    try {
        await client.query('BEGIN');
        
        // خصم من المرسل
        await client.query(
            'UPDATE accounts SET balance = balance - $1 WHERE user_id = $2',
            [amount, fromId]
        );
        
        // إضافة للمستقبل
        await client.query(
            'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2',
            [amount, toId]
        );
        
        await client.query('COMMIT');
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
```

### الاستعلامات المكانية

#### استعلام BBOX

```javascript
async function getFeaturesInBBOX(layer, minX, minY, maxX, maxY) {
    const result = await servicesPool.query(
        `SELECT * FROM ${layer}
         WHERE ST_Intersects(
             geom,
             ST_MakeEnvelope($1, $2, $3, $4, 28191)
         )`,
        [minX, minY, maxX, maxY]
    );
    return result.rows;
}
```

#### استعلام المسافة

```javascript
async function getNearbyProviders(layer, x, y, distance) {
    const result = await servicesPool.query(
        `SELECT *, 
         ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 28191)) as distance
         FROM ${layer}
         WHERE ST_DWithin(
             geom,
             ST_SetSRID(ST_MakePoint($1, $2), 28191),
             $3
         )
         ORDER BY distance`,
        [x, y, distance]
    );
    return result.rows;
}
```

## المصادقة والتخويل

### تشفير كلمة المرور

```javascript
const bcrypt = require('bcrypt');
const BCRYPT_SALT_ROUNDS = 10;

async function hashPassword(plainPassword) {
    return await bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
}

async function verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
}
```

### توليد رمز JWT

```javascript
const jwt = require('jsonwebtoken');

function generateToken(user) {
    return jwt.sign(
        { 
            user_id: user.user_id, 
            role: user.role,
            email: user.email 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null;
    }
}
```

### التحقق من الجلسة

```javascript
async function verifySession(userId) {
    const result = await servicesPool.query(
        'SELECT force_logout_flag FROM users WHERE user_id = $1',
        [userId]
    );
    
    if (result.rows[0]?.force_logout_flag) {
        return { valid: false, force_logout: true };
    }
    
    return { valid: true, force_logout: false };
}
```

## أحداث Socket.io

### إرسال الحدث

```javascript
// إرسال لمستخدم محدد
function emitToUser(userId, eventName, data) {
    const socketId = connectedUsers.get(userId);
    if (socketId && global.io) {
        global.io.to(socketId).emit(eventName, data);
    }
}

// إرسال لجميع المستخدمين المتصلين
function emitToAll(eventName, data) {
    if (global.io) {
        global.io.emit(eventName, data);
    }
}
```

### معالجات الأحداث

```javascript
io.on('connection', (socket) => {
    const userId = socket.handshake.query.user_id;
    
    // معالجة الأحداث المخصصة
    socket.on('join_room', (data) => {
        socket.join(data.room);
    });
    
    socket.on('send_message', async (data) => {
        // حفظ الرسالة في قاعدة البيانات
        await saveMessage(data);
        // إرسال للمستقبل
        emitToUser(data.recipientId, 'new_message', data);
    });
    
    socket.on('disconnect', () => {
        connectedUsers.delete(userId);
    });
});
```

## معالجة الأخطاء

### معالج الأخطاء العام

```javascript
app.use((err, req, res, next) => {
    console.error('خطأ عام:', err);
    
    if (err instanceof SyntaxError && err.status === 400) {
        return res.status(400).json({ 
            success: false, 
            error: 'JSON غير صالح' 
        });
    }
    
    res.status(500).json({ 
        success: false, 
        error: 'خطأ في الخادم الداخلي',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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

## تطوير البرمجيات الوسيطة

### برمجيات وسيطة مخصصة

```javascript
function requestLogger(req, res, next) {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
}

function validateParams(requiredParams) {
    return (req, res, next) => {
        const missing = requiredParams.filter(param => !req.body[param]);
        if (missing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `معاملات مفقودة: ${missing.join(', ')}` 
            });
        }
        next();
    };
}

// الاستخدام
app.post('/api/endpoint', 
    requestLogger,
    validateParams(['param1', 'param2']),
    async (req, res) => {
        // منطق المعالج
    }
);
```

## تطبيق الأمان

### التحقق من صحة الإدخال

```javascript
function sanitizeInput(input) {
    if (typeof input === 'string') {
        return input.trim().replace(/[<>]/g, '');
    }
    return input;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePhone(phone) {
    const phoneRegex = /^05[0-9]{8}$/;
    return phoneRegex.test(phone);
}
```

### تحديد المعدل

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 100,
    message: 'طلبات كثيرة جداً من هذا IP'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'محاولات تسجيل دخول كثيرة جداً'
});

app.use('/api/', apiLimiter);
app.post('/api/auth/login', authLimiter);
```

## الاختبار

### اختبار الوحدة

```javascript
const request = require('supertest');
const app = require('./server');

describe('نقاط نهاية واجهة برمجة التطبيقات', () => {
    test('GET /api/users يجب أن يُرجع قائمة المستخدمين', async () => {
        const response = await request(app)
            .get('/api/users')
            .expect('Content-Type', /json/)
            .expect(200);
        
        expect(response.body.success).toBe(true);
    });
});
```

### اختبار التكامل

```javascript
describe('تدفق طلب الخدمة', () => {
    test('دورة حياة طلب الخدمة الكاملة', async () => {
        // إنشاء الطلب
        const createResponse = await request(app)
            .post('/api/service-requests')
            .send(requestData)
            .expect(200);
        
        const requestId = createResponse.body.requestId;
        
        // الرد على الطلب
        const responseResponse = await request(app)
            .post(`/api/service-requests/${requestId}/respond`)
            .send({ action: 'accept' })
            .expect(200);
        
        expect(responseResponse.body.status).toBe('accepted');
    });
});
```

## تحسين الأداء

### تحسين الاستعلامات

```javascript
// استخدام الفهارس
async function getActiveRequests(userId) {
    const result = await servicesPool.query(
        `SELECT * FROM service_requests 
         WHERE user_id = $1 AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
    );
    return result.rows;
}

// استخدام تجمع الاتصالات
const pool = new Pool({
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});
```

### التخزين المؤقت

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 });

async function getCachedData(key, fetchFunction) {
    const cached = cache.get(key);
    if (cached) return cached;
    
    const data = await fetchFunction();
    cache.set(key, data);
    return data;
}
```

## أفضل الممارسات

### تنظيم الكود

1. **فصل الاهتمامات**: ابق المسارات والبرمجيات الوسيطة والأدوات منفصلة
2. **استخدام async/await**: لمعالجة أخطاء أفضل
3. **معالجة الأخطاء**: استخدم دائماً كتل try-catch
4. **التحقق من صحة الإدخال**: تحقق من جميع إدخالات المستخدم
5. **استخدام الاستعلامات المُعَلَّمة**: منع حقن SQL

### الأمان

1. **لا تثق أبداً بإدخال العميل**: تحقق من الصحة ونظف دائماً
2. **استخدم متغيرات البيئة**: لا تقم أبداً بتشفير بيانات الاعتماد
3. **نفذ تحديد المعدل**: منع الإساءة
4. **استخدم HTTPS**: في الإنتاج
5. **حافظ على تحديث التبعيات**: تحديثات أمنية منتظمة

### الأداء

1. **استخدم تجمع الاتصالات**: إعادة استخدام اتصالات قاعدة البيانات
2. **نفذ التخزين المؤقت**: تخزين البيانات التي يتم الوصول إليها بشكل متكرر
3. **حسّن الاستعلامات**: استخدم الفهارس وهيكل الاستعلام الصحيح
4. **استخدم الضغط**: ضغط الاستجابات
5. **راقب الأداء**: تتبع أوقات الاستجابة

## استكشاف الأخطاء وإصلاحها

### المشاكل الشائعة

#### فشل اتصال قاعدة البيانات

1. تحقق من تشغيل PostgreSQL
2. تحقق من بيانات اعتماد الاتصال
3. تحقق من اتصال الشبكة
4. تحقق من وجود قاعدة البيانات

#### مشاكل اتصال Socket.io

1. تحقق من تشغيل الخادم
2. تحقق من تكوين Socket.io
3. تحقق من إعدادات CORS
4. تحقق من اتصال العميل

#### تسرب الذاكرة

1. راقب استخدام الذاكرة
2. تحقق من الاتصالات غير المغلقة
3. تحقق من إزالة مستمعي الأحداث
4. تحقق من الاحتفاظ بالبيانات الكبيرة

---

**آخر تحديث**: 29 يوليو 2026  
**الإصدار**: 1.0.0  
**الصيانة بواسطة**: فريق التطوير

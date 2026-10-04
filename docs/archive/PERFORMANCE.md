# دليل الأداء (Performance Guide)

## نظرة عامة

يقدم هذا المستند إرشادات شاملة لتحسين أداء منصة خريطة خدمات فلسطين. يغطي تحسين قاعدة البيانات، استراتيجيات التخزين المؤقت، أداء الواجهة الأمامية، أداء واجهة برمجة التطبيقات، وتقنيات المراقبة.

## أداء قاعدة البيانات

### تجمع الاتصالات

#### التكوين الحالي

```javascript
const servicesPool = new Pool({
    host: PG_HOST,
    port: PG_PORT,
    database: SERVICES_DB_NAME,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    max: 20  // حجم تجمع الاتصالات الافتراضي
});
```

#### توصيات التحسين

**حجم تجمع الاتصالات**:
- **الحالي**: 20 اتصال لكل تجمع
- **الموصى به**: 20-50 اتصال لكل تجمع
- **الصيغة**: `(cores * 2) + effective_spindle_count`
- **التأثير**: الاتصالات القليلة جداً تسبب التنازع، والكثيرة جداً تسبب النفقات العامة

**مهلة الاتصال**:
- **الحالي**: غير محدد صراحة (افتراضي PostgreSQL)
- **الموصى به**: 30 ثانية
- **التنفيذ**:

```javascript
const servicesPool = new Pool({
    // ... تكوين آخر
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
});
```

### تحسين الاستعلام

#### تحسين الاستعلام المكانية

**استخدم الفهارس المكانية**:
```sql
-- تأكد من أن جميع أعمدة الهندسة لها فهارس GIST
CREATE INDEX IF NOT EXISTS idx_carpenter_geom 
ON carpenter USING GIST (geom);

-- فهرس جزئي للمزودين النشطين
CREATE INDEX IF NOT EXISTS idx_carpenter_active_geom 
ON carpenter USING GIST (geom) 
WHERE status = 0;
```

**تحسين استعلامات BBOX**:
```sql
-- ✅ محسّن مع فهرس
SELECT * FROM carpenter
WHERE ST_Intersects(
    geom,
    ST_MakeEnvelope($1, $2, $3, $4, 28191)
);

-- ❌ تجنب استدعاءات الدوال على أعمدة الهندسة
SELECT * FROM carpenter
WHERE ST_Intersects(
    ST_Transform(geom, 4326),
    ST_MakeEnvelope($1, $2, $3, $4, 4326)
);
```

**استخدم EXPLAIN ANALYZE**:
```sql
EXPLAIN ANALYZE
SELECT * FROM carpenter
WHERE ST_Intersects(
    geom,
    ST_MakeEnvelope(169000, 146000, 169500, 146500, 28191)
);
```

#### تحسين الاستعلام العام

**استخدم الاستعلامات المُعلمّة**:
```javascript
// ✅ محسّن
await servicesPool.query(
    'SELECT * FROM users WHERE user_id = $1',
    [userId]
);

// ❌ غير محسّن
await servicesPool.query(
    `SELECT * FROM users WHERE user_id = ${userId}`
);
```

**حدد الأعمدة المطلوبة فقط**:
```javascript
// ✅ محسّن
await servicesPool.query(
    'SELECT id, name, phone FROM users WHERE user_id = $1',
    [userId]
);

// ❌ غير محسّن
await servicesPool.query(
    'SELECT * FROM users WHERE user_id = $1',
    [userId]
);
```

**استخدم LIMIT لمجموعات النتائج الكبيرة**:
```javascript
// ✅ محسّن
await servicesPool.query(
    'SELECT * FROM service_requests ORDER BY created_at DESC LIMIT 10'
);

// ❌ غير محسّن
await servicesPool.query(
    'SELECT * FROM service_requests ORDER BY created_at DESC'
);
```

### استراتيجية الفهرسة

#### الفهارس المكانية

```sql
-- فهرس GIST للاستعلامات المكانية
CREATE INDEX idx_table_geom ON table_name USING GIST (geom);

-- فهرس جزئي لمجموعة فرعية يتم الاستعلام عنها بشكل متكرر
CREATE INDEX idx_table_active_geom 
ON table_name USING GIST (geom) 
WHERE status = 0;

-- تجميع الجدول حسب الفهرس المكاني
CLUSTER table_name USING idx_table_geom;
```

#### فهارس B-Tree

```sql
-- فهرس على الأعمدة التي يتم الاستعلام عنها بشكل متكرر
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);

-- فهرس مركب لأنماط الاستعلام الشائعة
CREATE INDEX idx_service_requests_user_status 
ON service_requests(user_id, status);

CREATE INDEX idx_service_requests_provider_status 
ON service_requests(provider_user_id, status);
```

#### صيانة الفهرس

```sql
-- إعادة فهرسة الفهارس
REINDEX INDEX idx_carpenter_geom;

-- تحليل إحصائيات الجدول
ANALYZE carpenter;

-- Vacuum الجدول
VACUUM ANALYZE carpenter;
```

## استراتيجية التخزين المؤقت

### التخزين المؤقت على مستوى التطبيق

#### التخزين المؤقت في الذاكرة

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // TTL 5 دقائق

// الحصول من التخزين المؤقت
const cachedData = cache.get('unique_features');
if (cachedData) {
    return cachedData;
}

// جلب من قاعدة البيانات
const data = await fetchFromDatabase();
cache.set('unique_features', data);
return data;
```

#### التخزين المؤقت Redis (موصى به للإنتاج)

```javascript
const redis = require('redis');
const client = redis.createClient();

// تعيين التخزين المؤقت
await client.setex('unique_features', 300, JSON.stringify(data));

// الحصول على التخزين المؤقت
const cached = await client.get('unique_features');
if (cached) {
    return JSON.parse(cached);
}
```

### التخزين المؤقت لاستعلام قاعدة البيانات

```javascript
const queryCache = new Map();

async function cachedQuery(query, params, ttl = 300) {
    const cacheKey = `${query}:${JSON.stringify(params)}`;
    
    if (queryCache.has(cacheKey)) {
        return queryCache.get(cacheKey);
    }
    
    const result = await servicesPool.query(query, params);
    queryCache.set(cacheKey, result);
    
    setTimeout(() => queryCache.delete(cacheKey), ttl * 1000);
    return result;
}
```

### التخزين المؤقت HTTP

#### التخزين المؤقت للأصول الثابتة

```javascript
app.use(express.static('public', {
    maxAge: '1d', // تخزين مؤقت ليوم واحد
    etag: true,
    lastModified: true
}));
```

#### التخزين المؤقت لاستجابة واجهة برمجة التطبيقات

```javascript
const cache = require('memory-cache');

app.get('/api/get-unique-values', (req, res) => {
    const cacheKey = `unique:${req.query.layer}:${req.query.field}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
        return res.json(cached);
    }
    
    // جلب البيانات
    const data = await fetchData();
    cache.put(cacheKey, data, 300 * 1000); // 5 دقائق
    res.json(data);
});
```

## أداء الواجهة الأمامية

### تقسيم الكود

#### تقسيم كود React

```javascript
import { lazy, Suspense } from 'react';

const MapComponent = lazy(() => import('./MapComponent'));
const ChatComponent = lazy(() => import('./ChatComponent'));

function App() {
    return (
        <Suspense fallback={<div>جاري التحميل...</div>}>
            <MapComponent />
            <ChatComponent />
        </Suspense>
    );
}
```

#### الاستيرادات الديناميكية

```javascript
// تحميل مكونات الخريطة فقط عند الحاجة
document.getElementById('load-map').addEventListener('click', async () => {
    const { initMap } = await import('./map.js');
    initMap();
});
```

### تحسين الأصول

#### تحسين الصور

```javascript
// استخدام تنسيق WebP
<img src="image.webp" alt="صورة محسّنة" />

// التحميل الكسول للصور
<img loading="lazy" src="image.jpg" alt="صورة محملة بكسل" />
```

#### تحسين الحزمة

```javascript
// vite.config.js
export default {
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'map': ['ol', 'proj4'],
                    'vendor': ['react', 'react-dom']
                }
            }
        }
    }
}
```

### أداء الخريطة

#### تحسين تحميل البلاطات

```javascript
const tileLayer = new ol.layer.Tile({
    source: new ol.source.TileWMS({
        url: '/geoserver-proxy/services/services/wms',
        params: {
            'LAYERS': 'carpenter',
            'TILED': true
        },
        tileLoadFunction: function(imageTile, src) {
            // تنفيذ التخزين المؤقت للبلاطات
            const cached = tileCache.get(src);
            if (cached) {
                imageTile.getImage().src = cached;
            } else {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                    tileCache.set(src, img.src);
                    imageTile.getImage().src = img.src;
                };
                img.src = src;
            }
        }
    })
});
```

#### استراتيجية تحميل المتجهات

```javascript
const vectorSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    loader: function(extent, resolution, projection) {
        // تحميل الميزات المرئية فقط
        const url = `/api/search-features?bbox=${extent.join(',')}`;
        fetch(url).then(response => response.json()).then(data => {
            vectorSource.addFeatures(vectorSource.getFormat().readFeatures(data));
        });
    },
    strategy: ol.loadingstrategy.bbox
});
```

## أداء واجهة برمجة التطبيقات

### تحسين وقت الاستجابة

#### الضغط

```javascript
const compression = require('compression');

app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    threshold: 1024 // ضغط الاستجابات الأكبر من 1KB فقط
}));
```

#### التصفح

```javascript
app.get('/api/service-requests', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const result = await servicesPool.query(
        'SELECT * FROM service_requests ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
    );
    
    res.json({
        success: true,
        data: result.rows,
        pagination: {
            page,
            limit,
            total: result.rowCount
        }
    });
});
```

### العمليات المجمعة

#### الإدراج المجمّع

```javascript
// ✅ إدراج مجمّع محسّن
await servicesPool.query(
    `INSERT INTO notifications (user_id, title, message) VALUES 
     ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)`,
    [1, 'Title1', 'Message1', 2, 'Title2', 'Message2', 3, 'Title3', 'Message3']
);

// ❌ غير محسّن (استعلامات متعددة)
for (const notification of notifications) {
    await servicesPool.query(
        'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
        [notification.user_id, notification.title, notification.message]
    );
}
```

## أداء Socket.io

### إدارة الغرف

```javascript
// الانضمام إلى غرفة خاصة بالمستخدم للأحداث المستهدفة
socket.on('connection', (socket) => {
    const userId = socket.handshake.query.user_id;
    socket.join(`user_${userId}`);
    
    // إرسال إلى مستخدم محدد
    io.to(`user_${userId}`).emit('event', data);
});
```

### تحسين الأحداث

```javascript
// تجميع الأحداث بدلاً من إرسالها بشكل فردي
const events = [];
events.push({ type: 'event1', data: data1 });
events.push({ type: 'event2', data: data2 });

socket.emit('batch_events', events);
```

## مراقبة الأداء

### مراقبة أداء التطبيق

#### تتبع وقت الاستجابة

```javascript
const responseTime = require('response-time');

app.use(responseTime((req, res, time) => {
    console.log(`${req.method} ${req.url} - ${time}ms`);
    
    // تسجيل الطلبات البطيئة
    if (time > 1000) {
        console.warn(`طلب بطيء: ${req.method} ${req.url} - ${time}ms`);
    }
}));
```

#### أداء استعلام قاعدة البيانات

```javascript
const originalQuery = servicesPool.query;
servicesPool.query = function(...args) {
    const start = Date.now();
    return originalQuery.apply(this, args).then(result => {
        const duration = Date.now() - start;
        console.log(`مدة الاستعلام: ${duration}ms`);
        
        if (duration > 1000) {
            console.warn(`استعلام بطيء: ${args[0]} - ${duration}ms`);
        }
        
        return result;
    });
};
```

### مراقبة النظام

#### استخدام الذاكرة

```javascript
setInterval(() => {
    const used = process.memoryUsage();
    console.log('استخدام الذاكرة:');
    console.log(`  RSS: ${Math.round(used.rss / 1024 / 1024)} MB`);
    console.log(`  الكومة الإجمالية: ${Math.round(used.heapTotal / 1024 / 1024)} MB`);
    console.log(`  الكومة المستخدمة: ${Math.round(used.heapUsed / 1024 / 1024)} MB`);
}, 60000); // كل دقيقة
```

#### استخدام وحدة المعالجة المركزية

```javascript
const os = require('os');

setInterval(() => {
    const cpus = os.cpus();
    const cpuUsage = cpus.map(cpu => {
        const times = cpu.times;
        const total = times.user + times.nice + times.system + times.idle + times.irq;
        const idle = times.idle;
        return { total, idle };
    });
    
    console.log('استخدام وحدة المعالجة المركزية:', cpuUsage);
}, 60000);
```

## اختبار الأداء

### اختبار الحمل

#### استخدام Apache Bench

```bash
# اختبار نقطة نهاية واجهة برمجة التطبيقات
ab -n 1000 -c 10 http://localhost:3000/api/service-requests

# اختبار مع المصادقة
ab -n 1000 -c 10 -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/service-requests
```

#### استخدام Artillery

```yaml
# config.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
      - get:
          url: "/api/service-requests"
```

```bash
artillery run config.yml
```

### اختبار أداء قاعدة البيانات

```sql
-- اختبار أداء الاستعلام
EXPLAIN ANALYZE SELECT * FROM carpenter WHERE ST_Intersects(
    geom,
    ST_MakeEnvelope(169000, 146000, 169500, 146500, 28191)
);

-- اختبار فعالية الفهرس
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'carpenter';
```

## أفضل ممارسات الأداء

### قاعدة البيانات

1. **استخدم الفهارس**: أنشئ فهارس مناسبة للأعمدة التي يتم الاستعلام عنها بشكل متكرر
2. **حسّن الاستعلامات**: استخدم EXPLAIN ANALYZE لتحديد الاستعلامات البطيئة
3. **تجمع الاتصالات**: قم بتكوين أحجام تجمع مناسبة
4. **الصيانة المنتظمة**: شغّل VACUUM ANALYZE بانتظام
5. **راقب الأداء**: تتبع أوقات الاستعلام والاستعلامات البطيئة

### التطبيق

1. **نفذ التخزين المؤقت**: خزن البيانات التي يتم الوصول إليها بشكل متكرر مؤقتاً
2. **استخدم الضغط**: مكن ضغط الاستجابة
3. **حسّن الحزم**: استخدم تقسيم الكود والتحميل الكسول
4. **راقب الأداء**: تتبع أوقات الاستجابة واستخدام الموارد
5. **اختبار الحمل**: اختبر تحت ظروف الحمل المتوقعة

### الواجهة الأمامية

1. **التحميل الكسول**: حمّل المكونات فقط عند الحاجة
2. **حسّن الأصول**: اضغط الصور، قلّل الكود
3. **استخدم CDN**: قدّم الأصول الثابتة من CDN
4. **نفذ التخزين المؤقت**: استخدم رؤوس التخزين المؤقت للمتصفح
5. **راقب الأداء**: تتبع أوقات التحميل وتجربة المستخدم

## أهداف الأداء

### أهداف وقت الاستجابة

- **نقاط نهاية واجهة برمجة التطبيقات**: < 200ms (p95)
- **استعلامات قاعدة البيانات**: < 100ms (p95)
- **الأصول الثابتة**: < 100ms (p95)
- **رسم الخريطة**: < 500ms (p95)
- **أحداث Socket.io**: < 50ms (p95)

### أهداف استخدام الموارد

- **استخدام وحدة المعالجة المركزية**: < 70% (متوسط)
- **استخدام الذاكرة**: < 80% (متوسط)
- **اتصالات قاعدة البيانات**: < 80% من التجمع
- **I/O القرص**: < 70% السعة

### أهداف التوفر

- **وقت التشغيل**: 99.9% (43.2 دقيقة توقف شهرياً)
- **معدل الأخطاء**: < 0.1%
- **وقت الاستجابة**: < 1s (p99)

## استكشاف أخطاء الأداء وإصلاحها

### استعلامات قاعدة البيانات البطيئة

1. **حدد الاستعلامات البطيئة**: استخدم pg_stat_statements
2. **حلل خطط الاستعلام**: استخدم EXPLAIN ANALYZE
3. **أضف فهارس**: أنشئ الفهارس المفقودة
4. **حسّن الاستعلامات**: أعد كتابة الاستعلامات غير الفعالة
5. **حدّث الإحصائيات**: شغّل ANALYZE

### استخدام الذاكرة العالي

1. **حدد تسريبات الذاكرة**: استخدم ملف الذاكرة
2. **تحقق من تجمعات الاتصالات**: تأكد من تحرير الاتصالات
3. **راجع التخزين المؤقت**: تحقق من حجم التخزين المؤقت و TTL
4. **حسّن هياكل البيانات**: استخدم هياكل بيانات فعالة
5. **راقب جمع البيانات المهملة**: تحقق من تردد GC

### استجابات واجهة برمجة التطبيقات البطيئة

1. **ملف نقاط النهاية**: حدد نقاط النهاية البطيئة
2. **تحقق من استعلامات قاعدة البيانات**: حسّن الاستعلامات البطيئة
3. **راجع البرمجيات الوسيطة**: أزل البرمجيات الوسيطة غير الضرورية
4. **نفذ التخزين المؤقت**: خزن البيانات التي يتم الوصول إليها بشكل متكرر مؤقتاً
5. **حسّن التسلسل**: استخدم التسلسل الفعال

---

**آخر تحديث**: 29 يوليو 2026  
**الإصدار**: 1.0.0  
**الصيانة بواسطة**: فريق التطوير

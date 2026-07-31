# دليل التسجيل والمراقبة (Logging and Monitoring Guide)

## نظرة عامة

يقدم هذا المستند إرشادات شاملة لتنفيذ التسجيل والمراقبة في منصة خريطة خدمات فلسطين. يغطي تسجيل التطبيق، مراقبة النظام، تتبع الأداء، واستراتيجيات التنبيه.

## استراتيجية التسجيل

### مستويات التسجيل

#### التنفيذ الحالي

تستخدم المنصة حالياً console.log مع مؤشرات الرموز التعبيرية:

```javascript
console.log('📥 محاولة تسجيل حساب جديد:', req.body);
console.error('❌ خطأ أثناء جلب الطلبات:', err.message);
console.warn('⚠️ [أمان] متغير البيئة ALLOWED_ORIGINS غير مضبوط');
```

#### مستويات التسجيل الموصى بها

```javascript
const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
};

function log(level, message, meta = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta
    };
    
    switch(level) {
        case LOG_LEVELS.ERROR:
            console.error(JSON.stringify(logEntry));
            break;
        case LOG_LEVELS.WARN:
            console.warn(JSON.stringify(logEntry));
            break;
        case LOG_LEVELS.INFO:
            console.info(JSON.stringify(logEntry));
            break;
        case LOG_LEVELS.DEBUG:
            console.debug(JSON.stringify(logEntry));
            break;
    }
}
```

### التسجيل المنظم

#### تنسيق JSON

```javascript
function structuredLog(level, message, context = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        message,
        service: 'psm-platform',
        environment: process.env.NODE_ENV || 'development',
        ...context
    };
    
    console.log(JSON.stringify(logEntry));
}

// الاستخدام
structuredLog('info', 'تسجيل دخول المستخدم', {
    user_id: 123,
    ip: req.ip,
    user_agent: req.headers['user-agent']
});
```

### فئات السجلات

#### سجلات التطبيق

```javascript
// سجلات المصادقة
log('info', 'محاولة تسجيل دخول المستخدم', {
    user_id: userId,
    email: email,
    success: true,
    ip: req.ip
});

// سجلات واجهة برمجة التطبيقات
log('info', 'طلب واجهة برمجة التطبيقات', {
    method: req.method,
    url: req.url,
    user_id: req.user?.user_id,
    response_time: duration
});

// سجلات قاعدة البيانات
log('debug', 'استعلام قاعدة البيانات', {
    query: queryText,
    duration: queryDuration,
    rows_affected: rowCount
});

// سجلات Socket.io
log('info', 'اتصال المقبس', {
    user_id: userId,
    socket_id: socket.id,
    event: 'connection'
});
```

#### سجلات الأخطاء

```javascript
// تسجيل الأخطاء مع تتبع المكدس
log('error', 'فشل اتصال قاعدة البيانات', {
    error: error.message,
    stack: error.stack,
    host: dbHost,
    port: dbPort
});

// أخطاء التحقق من الصحة
log('warn', 'فشل التحقق من صحة الإدخال', {
    field: 'email',
    value: email,
    error: 'تنسيق البريد الإلكتروني غير صالح',
    user_id: userId
});
```

#### سجلات الأمان

```javascript
// فشلات المصادقة
log('warn', 'فشل المصادقة', {
    email: email,
    ip: req.ip,
    reason: 'كلمة مرور غير صالحة',
    attempt_count: attemptCount
});

// فشلات التفويض
log('warn', 'محاولة وصول غير مصرح بها', {
    user_id: userId,
    endpoint: req.url,
    required_role: 'admin',
    user_role: userRole
});

// انتهاكات تحديد المعدل
log('warn', 'تجاوز حد المعدل', {
    ip: req.ip,
    endpoint: req.url,
    limit: rateLimit,
    current_requests: requestCount
});
```

## تنفيذ المراقبة

### مراقبة التطبيق

#### برمجية تسجيل الطلبات

```javascript
const responseTime = require('response-time');

app.use(responseTime((req, res, time) => {
    log('info', 'طلب HTTP', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: time,
        ip: req.ip,
        user_id: req.user?.user_id
    });
    
    // تسجيل الطلبات البطيئة
    if (time > 1000) {
        log('warn', 'تم اكتشاف طلب بطيء', {
            method: req.method,
            url: req.url,
            duration: time
        });
    }
}));
```

#### مراقبة استعلام قاعدة البيانات

```javascript
const originalQuery = servicesPool.query;

servicesPool.query = function(...args) {
    const start = Date.now();
    const query = args[0];
    
    return originalQuery.apply(this, args).then(result => {
        const duration = Date.now() - start;
        
        log('debug', 'استعلام قاعدة البيانات', {
            query: query.substring(0, 100), // اقتطاع الاستعلامات الطويلة
            duration: duration,
            rows: result.rowCount
        });
        
        // تسجيل الاستعلامات البطيئة
        if (duration > 500) {
            log('warn', 'استعلام قاعدة بيانات بطيء', {
                query: query.substring(0, 100),
                duration: duration
            });
        }
        
        return result;
    }).catch(error => {
        log('error', 'فشل استعلام قاعدة البيانات', {
            query: query.substring(0, 100),
            error: error.message
        });
        throw error;
    });
};
```

#### مراقبة Socket.io

```javascript
io.on('connection', (socket) => {
    const userId = socket.handshake.query.user_id;
    
    log('info', 'تم إنشاء اتصال المقبس', {
        user_id: userId,
        socket_id: socket.id,
        ip: socket.handshake.address
    });
    
    socket.on('disconnect', (reason) => {
        log('info', 'تم إغلاق اتصال المقبس', {
            user_id: userId,
            socket_id: socket.id,
            reason: reason
        });
    });
    
    socket.on('error', (error) => {
        log('error', 'خطأ المقبس', {
            user_id: userId,
            socket_id: socket.id,
            error: error.message
        });
    });
});
```

### مراقبة النظام

#### استخدام الذاكرة

```javascript
setInterval(() => {
    const used = process.memoryUsage();
    
    log('info', 'استخدام الذاكرة', {
        rss: Math.round(used.rss / 1024 / 1024) + ' MB',
        heap_total: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
        heap_used: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(used.external / 1024 / 1024) + ' MB'
    });
    
    // تنبيه على استخدام الذاكرة العالي
    if (used.heapUsed / used.heapTotal > 0.9) {
        log('warn', 'تم اكتشاف استخدام ذاكرة عالي', {
            heap_used: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
            heap_total: Math.round(used.heapTotal / 1024 / 1024) + ' MB'
        });
    }
}, 60000); // كل دقيقة
```

#### استخدام وحدة المعالجة المركزية

```javascript
const os = require('os');

setInterval(() => {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    
    log('info', 'مقاييس النظام', {
        cpu_count: cpus.length,
        load_average_1m: loadAverage[0],
        load_average_5m: loadAverage[1],
        load_average_15m: loadAverage[2],
        free_memory: Math.round(os.freemem() / 1024 / 1024) + ' MB',
        total_memory: Math.round(os.totalmem() / 1024 / 1024) + ' MB'
    });
    
    // تنبيه على الحمل العالي
    if (loadAverage[0] > cpus.length * 0.8) {
        log('warn', 'تم اكتشاف حمل وحدة المعالجة المركزية العالي', {
            load_average: loadAverage[0],
            cpu_count: cpus.length
        });
    }
}, 60000);
```

#### استخدام القرص

```javascript
const fs = require('fs');

setInterval(() => {
    const stats = fs.statSync('/');
    log('info', 'استخدام القرص', {
        path: '/',
        size: stats.size
    });
}, 300000); // كل 5 دقائق
```

## إدارة السجلات

### تدوير السجلات

#### تكوين Winston (موصى به)

```javascript
const winston = require('winston');
const { combine, timestamp, printf } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    return `${timestamp} [${level}]: ${message} ${JSON.stringify(metadata)}`;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp(),
        logFormat
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log' 
        })
    ]
});

// تدوير السجلات مع winston-daily-rotate-file
const DailyRotateFile = require('winston-daily-rotate-file');

logger.add(new DailyRotateFile({
    filename: 'logs/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d'
}));
```

### الاحتفاظ بالسجلات

#### التدوير اليدوي للسجلات

```bash
# /etc/logrotate.d/psm
/var/log/psm/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 psm psm
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

## أدوات المراقبة

### مراقبة PM2

```bash
# مراقبة التطبيق
pm2 monit

# عرض السجلات
pm2 logs

# عرض المقاييس
pm2 show psm-backend
```

### لوحة مراقبة مخصصة

```javascript
const express = require('express');
const monitoringApp = express();

monitoringApp.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: os.cpus(),
        timestamp: new Date()
    };
    res.json(health);
});

monitoringApp.get('/metrics', (req, res) => {
    const metrics = {
        requests_total: requestCount,
        requests_failed: failedRequestCount,
        db_queries_total: dbQueryCount,
        socket_connections: connectedUsers.size,
        memory_usage: process.memoryUsage()
    };
    res.json(metrics);
});

monitoringApp.listen(3001);
```

## التنبيه

### شروط التنبيه

#### التنبيهات الحرجة

```javascript
// النظام معطل
if (!process.uptime()) {
    sendAlert('CRITICAL', 'التطبيق معطل');
}

// فشل اتصال قاعدة البيانات
if (!dbConnected) {
    sendAlert('CRITICAL', 'فشل اتصال قاعدة البيانات');
}

// معدل أخطاء عالي
if (errorRate > 0.05) {
    sendAlert('CRITICAL', `معدل أخطاء عالي: ${errorRate}`);
}
```

#### تنبيهات التحذير

```javascript
// استخدام ذاكرة عالي
if (memoryUsage > 0.9) {
    sendAlert('WARNING', `استخدام ذاكرة عالي: ${memoryUsage}`);
}

// حمل وحدة المعالجة المركزية عالي
if (cpuLoad > 0.8) {
    sendAlert('WARNING', `حمل وحدة المعالجة المركزية العالي: ${cpuLoad}`);
}

// أوقات استجابة بطيئة
if (avgResponseTime > 2000) {
    sendAlert('WARNING', `أوقات استجابة بطيئة: ${avgResponseTime}ms`);
}
```

### تنفيذ التنبيه

```javascript
function sendAlert(level, message, context = {}) {
    const alert = {
        level,
        message,
        timestamp: new Date(),
        service: 'psm-platform',
        ...context
    };
    
    // تسجيل التنبيه
    log(level, `تنبيه: ${message}`, context);
    
    // إرسال إلى خدمة المراقبة
    if (process.env.ALERT_WEBHOOK) {
        fetch(process.env.ALERT_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert)
        });
    }
    
    // إرسال بريد إلكتروني للتنبيهات الحرجة
    if (level === 'CRITICAL' && process.env.ADMIN_EMAIL) {
        sendEmail(process.env.ADMIN_EMAIL, alert.message);
    }
}
```

## مراقبة الأداء

### تتبع وقت الاستجابة

```javascript
const responseTimes = [];

app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        responseTimes.push(duration);
        
        // الاحتفاظ بآخر 1000 قياس فقط
        if (responseTimes.length > 1000) {
            responseTimes.shift();
        }
    });
    
    next();
});

function getAverageResponseTime() {
    if (responseTimes.length === 0) return 0;
    const sum = responseTimes.reduce((a, b) => a + b, 0);
    return sum / responseTimes.length;
}

function getP95ResponseTime() {
    if (responseTimes.length === 0) return 0;
    const sorted = [...responseTimes].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
}
```

### أداء قاعدة البيانات

```javascript
const queryTimes = [];

function trackQuery(duration) {
    queryTimes.push(duration);
    
    if (queryTimes.length > 1000) {
        queryTimes.shift();
    }
}

function getAverageQueryTime() {
    if (queryTimes.length === 0) return 0;
    const sum = queryTimes.reduce((a, b) => a + b, 0);
    return sum / queryTimes.length;
}
```

## تحليل السجلات

### تجميع السجلات

#### مجموعة ELK (Elasticsearch, Logstash, Kibana)

```javascript
// إرسال السجلات إلى Elasticsearch
const { Client } = require('@elastic/elasticsearch');

const client = new Client({
    node: process.env.ELASTICSEARCH_URL
});

async function sendToElasticsearch(logEntry) {
    await client.index({
        index: `psm-logs-${new Date().toISOString().split('T')[0]}`,
        body: logEntry
    });
}
```

#### خدمات التسجيل السحابية

```javascript
// AWS CloudWatch
const AWS = require('aws-sdk');
const cloudwatchlogs = new AWS.CloudWatchLogs();

async function sendToCloudWatch(logEntry) {
    const params = {
        logGroupName: '/psm/application',
        logStreamName: new Date().toISOString(),
        logEvents: [{
            message: JSON.stringify(logEntry),
            timestamp: Date.now()
        }]
    };
    
    await cloudwatchlogs.putLogEvents(params).promise();
}
```

## أفضل الممارسات

### التسجيل

1. **استخدم التسجيل المنظم**: تنسيق JSON للتحليل السهل
2. **قم بتضمين السياق**: أضف بيانات وصفية ذات صلة بالسجلات
3. **استخدم مستويات تسجيل مناسبة**: ERROR، WARN، INFO، DEBUG
4. **تجنب البيانات الحساسة**: لا تسجل كلمات المرور أو الرموز أو البيانات الشخصية
5. **سجل عند الحدود**: سجل عند الدخول والخروج من الدوال

### المراقبة

1. **راقب المقاييس الرئيسية**: وقت الاستجابة، معدل الأخطاء، استخدام الموارد
2. **اضبط العتبات المناسبة**: تنبيه على شروط ذات معنى
3. **راقب في الوقت الفعلي**: استخدم لوحات المعلومات للمراقبة الحية
4. **التحليل التاريخي**: احتفظ بالسجلات لتحليل الاتجاهات
5. **التنبيهات الآلية**: قم بتكوين التنبيه الآلي

### إدارة السجلات

1. **دور السجلات**: نفذ تدوير السجلات لمنع ملء القرص
2. **الاحتفاظ بشكل مناسب**: احتفظ بالسجلات لفترة الاحتفاظ المطلوبة
3. **أمن السجلات**: احمِ ملفات السجلات من الوصول غير المصرح به
4. **نسخ احتياطي للسجلات**: نفذ استراتيجية نسخ احتياطي للسجلات
5. **الامتثال**: تأكد من أن التسجيل يلبي متطلبات الامتثال

## استكشاف الأخطاء وإصلاحها

### المشاكل الشائعة

#### السجلات لا تكتب

1. تحقق من أذونات الملفات
2. تحقق من مساحة القرص
3. تحقق من تكوين تدوير السجلات
4. تحقق من تشغيل خدمة التسجيل

#### حجم سجلات عالي

1. اضبط مستوى السجل لتقليل التفصيل
2. نفذ أخذ عينات السجلات
3. استخدم تجميع السجلات
4. راجع وحسّن عبارات التسجيل

#### المراقبة لا تعمل

1. تحقق من تشغيل خدمة المراقبة
2. تحقق من اتصال الشبكة
3. تحقق من بيانات اعتماد المصادقة
4. راجع إعدادات التكوين

---

**آخر تحديث**: 29 يوليو 2026  
**الإصدار**: 1.0.0  
**الصيانة بواسطة**: فريق التطوير

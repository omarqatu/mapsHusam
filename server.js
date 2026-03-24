// server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const { Pool } = require('pg'); 
const cors = require('cors');

const app = express();
const PORT = 3000;

// 1. إعدادات الاتصال بقاعدة البيانات
const pool = new Pool({
    user: 'Husam', 
    host: 'localhost',
    database: 'services_db', 
    password: '1234',
    port: 5432,
});

// فحص الاتصال بالقاعدة عند بدء التشغيل
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.stack);
    }
    console.log('🐘 تم الاتصال بـ PostgreSQL بنجاح باسم المستخدم: Husam');
    release();
});

// 2. الميدل وير (Middlewares)
app.use(cors());
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// 3. إعداد البروكسي لـ GeoServer
app.use('/proxy/geoserver', createProxyMiddleware({
    target: 'http://localhost:8080/geoserver',
    changeOrigin: true,
    pathRewrite: {
        // حذفنا rewrite المعقد لضمان تمرير المسارات مثل /wfs بشكل صحيح
        '^/proxy/geoserver': '' 
    },
    onProxyReq: (proxyReq, req, res) => {
        // لضمان تمرير بيانات الـ XML بشكل صحيح في طلبات الـ POST
        if (req.body && Object.keys(req.body).length) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
        }
    }
}));

// 4. مسار استقبال الإحصائيات (POST) - يستخدمه popup.js من الخريطة
app.post('/save-stat', async (req, res) => {
    const { user_id, provider, service } = req.body;
    
    console.log("📥 استلام بيانات جديدة للحفظ:", req.body);

    if (!user_id || !provider || !service) {
        console.log("⚠️ بيانات ناقصة في الطلب المستلم");
        return res.status(400).json({ error: 'Missing data fields' });
    }

    try {
        const query = `
            INSERT INTO "public"."map_service_stats" ("user_identifier", "provider_name", "service_type", "request_date") 
            VALUES ($1, $2, $3, NOW())
        `;
        
        await pool.query(query, [user_id, provider, service]);
        
        console.log(`✅ نجاح الحفظ في قاعدة البيانات للخدمة: ${service}`);
        res.status(200).json({ status: 'success', message: 'Stat saved successfully' });
    } catch (err) {
        console.error('❌ خطأ داخلي في SQL أثناء الحفظ:', err.message);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: err.message 
        });
    }
});

// 5. مسار جلب السجلات التفصيلية مع التصفح الصفحي (Pagination)
app.get('/api/stats-detailed', async (req, res) => {
    try {
        // تحديد الصفحة الحالية من الطلب (الافتراضي 1)
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // عدد السجلات في كل صفحة
        const offset = (page - 1) * limit;

        console.log(`📋 جلب السجلات - الصفحة: ${page}`);

        // استعلام لجلب البيانات المحدودة بـ LIMIT و OFFSET
        const dataQuery = `
            SELECT id, user_identifier, provider_name, service_type, 
            TO_CHAR(request_date, 'YYYY-MM-DD HH24:MI:SS') as formatted_date
            FROM "public"."map_service_stats" 
            ORDER BY request_date DESC 
            LIMIT $1 OFFSET $2
        `;
        
        // استعلام لمعرفة العدد الإجمالي للسجلات لحساب الصفحات
        const countQuery = 'SELECT COUNT(*) FROM "public"."map_service_stats"';

        const [dataRes, countRes] = await Promise.all([
            pool.query(dataQuery, [limit, offset]),
            pool.query(countQuery)
        ]);

        const totalRecords = parseInt(countRes.rows[0].count);
        const totalPages = Math.ceil(totalRecords / limit);

        // إرجاع البيانات مع معلومات الصفحات
        res.json({
            data: dataRes.rows,
            totalPages: totalPages,
            currentPage: page,
            totalRecords: totalRecords
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب البيانات التفصيلية:', err.message);
        res.status(500).json({ error: 'Failed to fetch logs', details: err.message });
    }
});

// 6. مسار حذف سجل معين (DELETE)
app.delete('/api/delete-stat/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = 'DELETE FROM "public"."map_service_stats" WHERE id = $1';
        await pool.query(query, [id]);
        
        console.log(`🗑️ تم حذف السجل رقم: ${id} بنجاح`);
        res.status(200).json({ status: 'success', message: `Record ${id} deleted` });
    } catch (err) {
        console.error('❌ خطأ أثناء حذف السجل:', err.message);
        res.status(500).json({ error: 'Failed to delete record', details: err.message });
    }
});

// 7. مسار ملخص الإحصائيات (للاحتياط)
app.get('/api/stats-summary', async (req, res) => {
    try {
        const query = `SELECT service_type, COUNT(*) as total_requests FROM "public"."map_service_stats" GROUP BY service_type ORDER BY total_requests DESC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. تقديم الملفات الثابتة
app.use(express.static(path.join(__dirname)));

// 9. تشغيل السيرفر
app.listen(PORT, () => {
    console.log('==============================================');
    console.log(`🚀 السيرفر يعمل الآن على: http://localhost:${PORT}`);
    console.log(`📊 لوحة التحكم: http://localhost:${PORT}/dashboard.html`);
    console.log(`📖 ميزة التصفح الصفحي (Pagination) مفعلة`);
    console.log('==============================================');
});
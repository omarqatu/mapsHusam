// "Add my business": submit, list, cancel; the admin approves or rejects.
import rateLimit from 'express-rate-limit';
import { IS_PROD, app } from '../app.js';
import { servicesPool } from '../database.js';
import { LAYER_AR_NAMES, isValidLayer } from '../layers.js';
import { authStatusCache, requireAdmin, requireAuth } from '../auth.js';
import { clearProviderLinkedCache, notifyUser, platformStatsCache } from '../state.js';
import { INSERT_SUBMISSION_SQL, SUBMISSION_MAX_LEN, SUBMITTABLE_LAYERS, cleanText, parseListingInput, submissionParams } from '../listings.js';

async function ensureListingSubmissionsSchema() {
    try {
        await servicesPool.query(`
            CREATE TABLE IF NOT EXISTS public.listing_submissions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                layer TEXT NOT NULL,
                name TEXT NOT NULL,
                des TEXT,
                phone TEXT NOT NULL,
                whatsapp TEXT,
                work_hours TEXT,
                price NUMERIC,
                x_coord NUMERIC NOT NULL,
                y_coord NUMERIC NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                reject_reason TEXT,
                feature_id INTEGER,
                reviewed_by INTEGER,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                reviewed_at TIMESTAMP
            )
        `);
        // طلب معلّق واحد فقط لكل مستخدم (يمنع الإغراق ويحسم التسابق بين نقرتين)
        await servicesPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS listing_submissions_one_pending ON public.listing_submissions (user_id) WHERE status = 'pending'`);
        await servicesPool.query(`CREATE INDEX IF NOT EXISTS listing_submissions_status_idx ON public.listing_submissions (status, created_at DESC)`);
    } catch (err) {
        console.error('⚠️ خطأ أثناء إنشاء جدول طلبات إضافة الأنشطة:', err.message);
    }
}
ensureListingSubmissionsSchema();

const submissionLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'وصلت الحد اليومي لتقديم الطلبات، حاول غداً.' }
});



app.get('/api/listing-submissions/layers', (req, res) => res.json({ success: true, layers: SUBMITTABLE_LAYERS }));



app.post('/api/listing-submissions', requireAuth, submissionLimiter, async (req, res) => {
    const parsed = parseListingInput(req.body);
    if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });
    const listing = parsed.value;

    try {
        const owner = await servicesPool.query('SELECT role, service_layer, feature_id FROM public.users WHERE user_id = $1', [req.auth.uid]);
        const row = owner.rows[0];
        if (!row || row.role !== 'user' || row.feature_id) {
            return res.status(403).json({ success: false, error: 'حسابك مرتبط بنشاط بالفعل أو لا يملك صلاحية التقديم.' });
        }
        const inserted = await servicesPool.query(INSERT_SUBMISSION_SQL, submissionParams(req.auth.uid, listing));
        res.json({ success: true, submission: inserted.rows[0] });
        // المشرفون يعرفون بالطلب فوراً (إشعار + بث حي لمن هو متصل)
        try {
            const admins = await servicesPool.query(`SELECT user_id FROM public.users WHERE role = 'admin' AND is_active = true`);
            await Promise.all(admins.rows.map(a => notifyUser(a.user_id, '📥 طلب إضافة نشاط جديد', `«${listing.name}» بانتظار المراجعة من صفحة طلبات الإضافة.`)));
        } catch (notifyErr) {
            console.error('⚠️ تعذر إشعار المشرفين بالطلب الجديد:', notifyErr.message);
        }
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ success: false, error: 'لديك طلب قيد المراجعة بالفعل.' });
        console.error('❌ خطأ أثناء تقديم طلب إضافة نشاط:', err.message);
        res.status(500).json({ success: false, error: 'فشل تقديم الطلب.' });
    }
});

app.get('/api/listing-submissions/mine', requireAuth, async (req, res) => {
    try {
        const result = await servicesPool.query(
            `SELECT id, layer, name, status, reject_reason, created_at, reviewed_at
             FROM public.listing_submissions WHERE user_id = $1 ORDER BY id DESC LIMIT 20`,
            [req.auth.uid]
        );
        res.json({ success: true, submissions: result.rows });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب طلباتي:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب الطلبات.' });
    }
});

app.delete('/api/listing-submissions/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, error: 'رقم غير صالح.' });
    try {
        const result = await servicesPool.query(
            `DELETE FROM public.listing_submissions WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
            [id, req.auth.uid]
        );
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'لا يوجد طلب معلّق بهذا الرقم.' });
        res.json({ success: true });
    } catch (err) {
        console.error('❌ خطأ أثناء إلغاء الطلب:', err.message);
        res.status(500).json({ success: false, error: 'فشل إلغاء الطلب.' });
    }
});

app.get('/api/admin/listing-submissions', requireAdmin, async (req, res) => {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    try {
        const result = await servicesPool.query(
            `SELECT s.*, u.full_name AS user_name, u.phone AS user_phone
             FROM public.listing_submissions s LEFT JOIN public.users u ON u.user_id = s.user_id
             WHERE s.status = $1 ORDER BY s.created_at ASC LIMIT 200`,
            [status]
        );
        res.json({ success: true, submissions: result.rows });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب طلبات الإضافة:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب الطلبات.' });
    }
});

app.post('/api/admin/listing-submissions/:id/approve', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, error: 'رقم غير صالح.' });
    const body = req.body || {};
    const client = await servicesPool.connect();
    try {
        await client.query('BEGIN');
        const found = await client.query('SELECT * FROM public.listing_submissions WHERE id = $1 FOR UPDATE', [id]);
        const sub = found.rows[0];
        if (!sub) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'الطلب غير موجود.' }); }
        if (sub.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ success: false, error: 'تمت مراجعة هذا الطلب مسبقاً.' }); }
        if (!isValidLayer(sub.layer)) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: 'نوع النشاط لم يعد مسموحاً.' }); }

        const ownerRes = await client.query('SELECT role, feature_id, is_active FROM public.users WHERE user_id = $1 FOR UPDATE', [sub.user_id]);
        const owner = ownerRes.rows[0];
        if (!owner || owner.role !== 'user' || owner.feature_id) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, error: 'حساب صاحب الطلب لم يعد مؤهلاً (مرتبط بنشاط أو غير موجود).' });
        }

        // المشرف يستطيع تصحيح النص قبل النشر
        const name = cleanText(body.name, SUBMISSION_MAX_LEN.name) || sub.name;
        const des = body.des !== undefined ? cleanText(body.des, SUBMISSION_MAX_LEN.des) : sub.des;
        const workHours = body.work_hours !== undefined ? cleanText(body.work_hours, SUBMISSION_MAX_LEN.work_hours) : sub.work_hours;
        const searchTags = cleanText(body.search_tags, SUBMISSION_MAX_LEN.search_tags)
            || [LAYER_AR_NAMES[sub.layer] || sub.layer, name].join('، ');

        const created = await client.query(
            `INSERT INTO public.service_all (discriminator, name, des, phone, whatsapp, work_hours, price, search_tags, status, geom)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, ST_SetSRID(ST_MakePoint($9, $10), 28191))
             RETURNING id, x_coord, y_coord`,
            [sub.layer, name, des || null, sub.phone, sub.whatsapp, workHours || null, sub.price, searchTags, sub.x_coord, sub.y_coord]
        );
        const feature = created.rows[0];

        await client.query(
            `UPDATE public.users SET role = 'provider', is_active = true, service_layer = $1, feature_id = $2, x_coord = $3, y_coord = $4,
                    token_version = token_version + 1 WHERE user_id = $5`,
            [sub.layer, feature.id, feature.x_coord, feature.y_coord, sub.user_id]
        );
        await client.query(
            `UPDATE public.listing_submissions SET status = 'approved', feature_id = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
            [feature.id, req.adminUserId, id]
        );
        await client.query('COMMIT');

        authStatusCache.delete(Number(sub.user_id)); // الدور الجديد يسري فوراً وتُبطل الجلسة القديمة
        clearProviderLinkedCache();
        platformStatsCache.clear();
        await notifyUser(sub.user_id, '✅ تمت الموافقة على نشاطك',
            `تمت إضافة «${name}» إلى الخريطة وأصبح حسابك حساب مزوّد خدمة. ${owner.is_active ? 'يرجى تسجيل الخروج ثم الدخول من جديد لتفعيل الصلاحيات.' : 'حسابك مفعّل الآن، يمكنك تسجيل الدخول.'}`, 'success');
        res.json({ success: true, feature_id: feature.id });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('❌ خطأ أثناء الموافقة على طلب الإضافة:', err.message);
        res.status(500).json({ success: false, error: 'فشلت الموافقة.', details: IS_PROD ? undefined : err.message });
    } finally {
        client.release();
    }
});

app.post('/api/admin/listing-submissions/:id/reject', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, error: 'رقم غير صالح.' });
    const reason = cleanText((req.body || {}).reason, SUBMISSION_MAX_LEN.reject_reason);
    if (!reason) return res.status(400).json({ success: false, error: 'اكتب سبب الرفض ليعرفه صاحب الطلب.' });
    try {
        const result = await servicesPool.query(
            `UPDATE public.listing_submissions SET status = 'rejected', reject_reason = $1, reviewed_by = $2, reviewed_at = NOW()
             WHERE id = $3 AND status = 'pending' RETURNING user_id, name`,
            [reason, req.adminUserId, id]
        );
        if (result.rowCount === 0) return res.status(409).json({ success: false, error: 'الطلب غير موجود أو تمت مراجعته.' });
        await notifyUser(result.rows[0].user_id, '❌ لم تتم الموافقة على طلبك', `«${result.rows[0].name}»: ${reason}`, 'warning');
        res.json({ success: true });
    } catch (err) {
        console.error('❌ خطأ أثناء رفض طلب الإضافة:', err.message);
        res.status(500).json({ success: false, error: 'فشل الرفض.' });
    }
});

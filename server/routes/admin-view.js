// The admin's read-only view of a user's account.
import jwt from 'jsonwebtoken';
import { ADMIN_JWT_SECRET, app } from '../app.js';
import { servicesPool } from '../database.js';
import { requireAdmin } from '../auth.js';

// جلسة مشاهدة مؤقتة للمشرف: قراءة الطلبات والرسائل فقط دون انتحال جلسة المستخدم.
async function requireReadOnlyView(req, res, next) {
    const token = req.headers['x-read-only-view'] || null;
    if (!token) {
        return res.status(401).json({ success: false, error: 'رمز المشاهدة مفقود.' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
        return res.status(401).json({ success: false, error: 'انتهت جلسة المشاهدة أو أصبحت غير صالحة.' });
    }

    if (decoded.type !== 'readonly_view' || !decoded.admin_uid || !decoded.target_uid) {
        return res.status(403).json({ success: false, error: 'رمز مشاهدة غير صالح.' });
    }
    if (!req.adminUserId || Number(decoded.admin_uid) !== Number(req.adminUserId)) {
        return res.status(403).json({ success: false, error: 'رابط المشاهدة مرتبط بحساب المشرف الذي أنشأه.' });
    }

    try {
        const adminResult = await servicesPool.query(
            'SELECT role, is_active, force_logout_flag FROM public.users WHERE user_id = $1',
            [decoded.admin_uid]
        );
        if (adminResult.rows.length === 0 || adminResult.rows[0].role !== 'admin' || !adminResult.rows[0].is_active || adminResult.rows[0].force_logout_flag === true) {
            return res.status(403).json({ success: false, error: 'جلسة المشرف غير صالحة.' });
        }

        req.readOnlyView = {
            adminUserId: Number(decoded.admin_uid),
            targetUserId: Number(decoded.target_uid)
        };
        next();
    } catch (e) {
        console.error('❌ خطأ في التحقق من جلسة المشاهدة:', e.message);
        return res.status(500).json({ success: false, error: 'تعذر التحقق من جلسة المشاهدة.' });
    }
}

app.post('/api/admin/view-session', requireAdmin, async (req, res) => {
    const targetUserId = Number(req.body?.user_id);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم غير صالح.' });
    }

    try {
        const userResult = await servicesPool.query(
            `SELECT user_id, full_name, phone, email, role, is_active, service_layer, feature_id
             FROM public.users WHERE user_id = $1`,
            [targetUserId]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود.' });
        }

        const viewToken = jwt.sign({
            type: 'readonly_view',
            admin_uid: Number(req.adminUserId),
            target_uid: targetUserId,
            target_role: userResult.rows[0].role
        }, ADMIN_JWT_SECRET, { expiresIn: '30m' });

        res.json({ success: true, expires_in: 1800, token: viewToken, user: userResult.rows[0] });
    } catch (err) {
        console.error('❌ خطأ في إنشاء جلسة المشاهدة:', err.message);
        res.status(500).json({ success: false, error: 'تعذر إنشاء جلسة المشاهدة.' });
    }
});

app.get('/api/admin/view-session/profile', requireAdmin, requireReadOnlyView, async (req, res) => {
    try {
        const result = await servicesPool.query(
            `SELECT user_id, full_name, phone, email, role, is_active, service_layer, feature_id
             FROM public.users WHERE user_id = $1`,
            [req.readOnlyView.targetUserId]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'المستخدم غير موجود.' });
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'تعذر جلب بيانات المستخدم.' });
    }
});

app.get('/api/admin/view-session/requests', requireAdmin, requireReadOnlyView, async (req, res) => {
    try {
        const result = await servicesPool.query(
            `SELECT sr.id, sr.user_id, sr.provider_user_id, sr.service_layer, sr.feature_id,
                    sr.provider_name, sr.service_type, sr.status, sr.cancellation_reason,
                    sr.created_at, sr.updated_at,
                    ru.full_name AS requester_name, pu.full_name AS provider_full_name
             FROM public.service_requests sr
             LEFT JOIN public.users ru ON ru.user_id = sr.user_id
             LEFT JOIN public.users pu ON pu.user_id = sr.provider_user_id
             WHERE sr.user_id = $1 OR sr.provider_user_id = $1
             ORDER BY sr.created_at DESC`,
            [req.readOnlyView.targetUserId]
        );
        res.json({ success: true, requests: result.rows });
    } catch (err) {
        console.error('❌ خطأ في جلب طلبات جلسة المشاهدة:', err.message);
        res.status(500).json({ success: false, error: 'تعذر جلب الطلبات.' });
    }
});

app.get('/api/admin/view-session/requests/:id/messages', requireAdmin, requireReadOnlyView, async (req, res) => {
    try {
        const requestResult = await servicesPool.query(
            'SELECT id, user_id, provider_user_id, status, service_type FROM public.service_requests WHERE id = $1',
            [req.params.id]
        );
        if (requestResult.rows.length === 0) return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });

        const request = requestResult.rows[0];
        if (Number(request.user_id) !== req.readOnlyView.targetUserId && Number(request.provider_user_id) !== req.readOnlyView.targetUserId) {
            return res.status(403).json({ success: false, error: 'هذا الطلب خارج نطاق جلسة المشاهدة.' });
        }

        const messages = await servicesPool.query(
            `SELECT id, request_id, sender_role, sender_id, message, created_at
             FROM public.service_request_messages WHERE request_id = $1 ORDER BY created_at ASC`,
            [req.params.id]
        );
        res.json({ success: true, request, messages: messages.rows });
    } catch (err) {
        console.error('❌ خطأ في جلب رسائل جلسة المشاهدة:', err.message);
        res.status(500).json({ success: false, error: 'تعذر جلب رسائل الطلب.' });
    }
});

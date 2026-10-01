// Admin-editable texts and settings (platform_content).
import { app } from '../app.js';
import { servicesPool } from '../database.js';
import { requireAdmin } from '../auth.js';

// ==========================================
// API - إدارة المستخدمين (للمشرف فقط)
// ==========================================


// محتوى المنصة القابل للتحرير: القيمة العامة للقراءة، والتعديل محصور بالأدمن.
async function ensurePlatformContentSchema() {
    try {
        await servicesPool.query(`
            CREATE TABLE IF NOT EXISTS public.platform_content (
                content_key TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                content_value TEXT NOT NULL DEFAULT '',
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_by BIGINT
            )
        `);
    } catch (err) {
        console.error('تعذر إنشاء جدول محتوى المنصة:', err.message);
    }
}
ensurePlatformContentSchema();

app.get('/api/platform-content', async (req, res) => {
    try {
        const result = await servicesPool.query(
            'SELECT content_key, label, content_value, updated_at FROM public.platform_content ORDER BY content_key'
        );
        res.json({ success: true, items: result.rows });
    } catch (err) {
        console.error('تعذر جلب محتوى المنصة:', err.message);
        res.status(500).json({ success: false, error: 'تعذر جلب محتوى المنصة.' });
    }
});

// قيمة واحدة بمفتاحها (عام): الواجهة تحتاج إعداداً صغيراً (مثل settings.visibility) دون تنزيل كل نصوص المنصة (~140KB).
// مفتاح غير محفوظ بعد ليس خطأً: item = null (لا 404، حتى لا يسجّل متصفح كل زائر خطأً في كل صفحة).
app.get('/api/platform-content/:key', async (req, res) => {
    try {
        const result = await servicesPool.query(
            'SELECT content_key, label, content_value, updated_at FROM public.platform_content WHERE content_key = $1',
            [String(req.params.key || '')]
        );
        res.json({ success: true, item: result.rows[0] || null });
    } catch (err) {
        console.error('تعذر جلب محتوى المنصة:', err.message);
        res.status(500).json({ success: false, error: 'تعذر جلب محتوى المنصة.' });
    }
});

app.put('/api/admin/platform-content/:key', requireAdmin, async (req, res) => {
    const key = String(req.params.key || '').trim();
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    const value = typeof req.body?.value === 'string' ? req.body.value : null;
    if (!/^[a-z0-9][a-z0-9._-]{1,99}$/i.test(key) || !label || label.length > 160 || value === null || value.length > 100000) {
        return res.status(400).json({ success: false, error: 'تحقق من المفتاح والعنوان والنص (الحد الأقصى للنص 100,000 حرف).' });
    }
    try {
        const result = await servicesPool.query(
            `INSERT INTO public.platform_content (content_key, label, content_value, updated_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (content_key) DO UPDATE SET label = EXCLUDED.label,
                content_value = EXCLUDED.content_value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
             RETURNING content_key, label, content_value, updated_at`,
            [key, label, value, req.adminUserId]
        );
        res.json({ success: true, item: result.rows[0] });
    } catch (err) {
        console.error('تعذر حفظ محتوى المنصة:', err.message);
        res.status(500).json({ success: false, error: 'تعذر حفظ المحتوى.' });
    }
});

app.delete('/api/admin/platform-content/:key', requireAdmin, async (req, res) => {
    try {
        await servicesPool.query('DELETE FROM public.platform_content WHERE content_key = $1', [req.params.key]);
        res.json({ success: true });
    } catch (err) {
        console.error('تعذر حذف محتوى المنصة:', err.message);
        res.status(500).json({ success: false, error: 'تعذر حذف المحتوى.' });
    }
});

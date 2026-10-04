// The live information centre: widget groups, road barriers and fuel stations.
import { IS_PROD, app } from '../app.js';
import { servicesPool } from '../database.js';
import { requireAdmin } from '../auth.js';

// =========================================================================
// 🆕 [مركز المعلومات الحية]: مسارات جلب/حفظ المجموعات الست اليدوية، وجلب/
// تعديل حالة حواجز الطرق ومحطات الوقود (معالم حقيقية على الخريطة).
// =========================================================================
const WIDGETS_CONFIG_GROUPS = ['currency', 'gold', 'weather', 'fuel', 'transport_inter_city', 'transport_intra_city', 'events'];

// 📡 بثّ فوري لكل الاتصالات المسجّلة (الاتصال بلا توكن مرفوض) عند تحديث حالة الطرق/الوقود أو مجموعات مركز المعلومات.
// الزائر العام بلا socket فيبقى على الاستطلاع كل دقيقة. الحدث لا يحمل بيانات: العميل يعيد الجلب فقط.
function broadcastLiveUpdate(event, payload) {
    try {
        if (global.io) global.io.emit(event, payload);
    } catch (e) {
        console.warn('⚠️ تعذر بثّ التحديث الفوري:', e.message);
    }
}

// 🌐 عام (بدون حماية): تستخدمه واجهة العرض widgets-ticker.js وصفحة الإدارة
// لجلب تاريخ آخر تحديث حقيقي لحالة الطرق ومحطات الوقود
app.get('/api/widgets-data', async (req, res) => {
    try {
        const result = await servicesPool.query(`SELECT group_key, data, updated_at AT TIME ZONE current_setting('TimeZone') AS updated_at FROM public.widgets_manual_groups`);
        const groups = {};
        result.rows.forEach(row => {
            
            groups[row.group_key] = { items: row.data, updated_at: row.updated_at };
        });

        const roadResult = await servicesPool.query(`SELECT MAX(updated_at) AT TIME ZONE current_setting('TimeZone') as last FROM public.service_all WHERE discriminator = 'road_barriers'`);
        const fuelResult = await servicesPool.query(`SELECT MAX(updated_at) AT TIME ZONE current_setting('TimeZone') as last FROM public.service_all WHERE discriminator = 'fuel_stations'`);

        res.json({
            success: true,
            groups,
            road_status_updated_at: roadResult.rows[0].last,
            fuel_status_updated_at: fuelResult.rows[0].last
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب بيانات مركز المعلومات الحية:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب البيانات', details: IS_PROD ? undefined : err.message });
    }
});

// 🔒 للمشرف: جلب كل المجموعات الست للتعديل من صفحة الإدارة
app.get('/api/admin/widgets-data', requireAdmin, async (req, res) => {
    try {
        const result = await servicesPool.query(`SELECT group_key, data, updated_at AT TIME ZONE current_setting('TimeZone') AS updated_at FROM public.widgets_manual_groups`);
        const groups = {};
        result.rows.forEach(row => {
            groups[row.group_key] = { data: row.data, updated_at: row.updated_at };
        });
        res.json({ success: true, groups });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب مجموعات widgets للمشرف:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب البيانات', details: IS_PROD ? undefined : err.message });
    }
});

// 🔒 للمشرف: حفظ مجموعة كاملة (تحديث تلقائي لتاريخ آخر تعديل عبر NOW())
app.post('/api/admin/widgets-data/:groupKey', requireAdmin, async (req, res) => {
    const { groupKey } = req.params;
    const { items } = req.body;

    if (!WIDGETS_CONFIG_GROUPS.includes(groupKey)) {
        return res.status(400).json({ success: false, error: 'مجموعة غير معروفة' });
    }
    if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'صيغة البيانات غير صحيحة' });
    }

    try {
        await servicesPool.query(`
            INSERT INTO public.widgets_manual_groups (group_key, data, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (group_key) DO UPDATE SET data = $2, updated_at = NOW()
        `, [groupKey, JSON.stringify(items)]);

        broadcastLiveUpdate('widgets_updated', { group: groupKey });
        res.json({ success: true, message: 'تم حفظ التعديلات بنجاح' });
    } catch (err) {
        console.error('❌ خطأ أثناء حفظ مجموعة widgets:', err.message);
        res.status(500).json({ success: false, error: 'فشل الحفظ', details: IS_PROD ? undefined : err.message });
    }
});

// 🔒 للمشرف: جلب معالم حواجز الطرق ومحطات الوقود لتعديلها من صفحة الإدارة
app.get('/api/admin/road-fuel-features', requireAdmin, async (req, res) => {
    try {
        const roadResult = await servicesPool.query(
            `SELECT id, name, stop, stop2, updated_at AT TIME ZONE current_setting('TimeZone') AS updated_at FROM public.service_all WHERE discriminator = 'road_barriers' ORDER BY display_order NULLS LAST, id ASC`
        );
        const fuelResult = await servicesPool.query(
            `SELECT id, name, diesel, banzen95, banzen98, updated_at AT TIME ZONE current_setting('TimeZone') AS updated_at FROM public.service_all WHERE discriminator = 'fuel_stations' ORDER BY display_order NULLS LAST, id ASC`
        );
        res.json({ success: true, roadBarriers: roadResult.rows, fuelStations: fuelResult.rows });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب معالم الحواجز/المحطات:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب البيانات', details: IS_PROD ? undefined : err.message });
    }
});

// 🆕 حفظ الترتيب اليدوي الجديد لحواجز الطرق أو محطات الوقود
app.post('/api/admin/reorder-features', requireAdmin, async (req, res) => {
    const { layer, orderedIds } = req.body;
    if (!['road_barriers', 'fuel_stations'].includes(layer) || !Array.isArray(orderedIds)) {
        return res.status(400).json({ success: false, error: 'بيانات غير صالحة' });
    }
        try {
        // 🆕 التحديث الآن على جدول service_all موحّد، مع فلترة discriminator + id معاً
        // لضمان عدم التأثير على أي خدمة أخرى بنفس رقم id (الـ id أصبح فريداً عالمياً فعلاً، لكن هذا أمان إضافي)
        await Promise.all(orderedIds.map((id, index) =>
            servicesPool.query(
                `UPDATE public.service_all SET display_order = $1 WHERE id = $2 AND discriminator = $3`,
                [index, id, layer]
            )
        ));
        res.json({ success: true });
    } catch (err) {
        console.error('❌ خطأ أثناء حفظ الترتيب:', err.message);
        res.status(500).json({ success: false, error: 'فشل حفظ الترتيب', details: IS_PROD ? undefined : err.message });
    }
});
// 🆕 قيم الحالة المسموحة (حالة الحاجز: 0..4، توفر الوقود: 0/1) + تنقية قائمة المعرّفات
const ROAD_STOP_VALUES = ['0', '1', '2', '3', '4'];
const FUEL_AVAIL_VALUES = ['0', '1'];
function parseIdList(rawIds) {
    if (!Array.isArray(rawIds)) return [];
    const ids = rawIds.map(v => parseInt(v, 10)).filter(n => Number.isInteger(n) && n > 0);
    return Array.from(new Set(ids)).slice(0, 5000);
}
function hasStatusValue(v) {
    return v !== undefined && v !== null && String(v).trim() !== '';
}

// 🔒 للمشرف: تحديث حالة حاجز طريق واحد
// stop = الحالة للداخل، stop2 = الحالة للخارج (كلاهما اختياري، لكن واحد منهما على الأقل مطلوب)
app.post('/api/admin/update-road-barrier', requireAdmin, async (req, res) => {
    const { id, stop, stop2 } = req.body;
    const hasStop = hasStatusValue(stop);
    const hasStop2 = hasStatusValue(stop2);

    if (id === undefined || (!hasStop && !hasStop2)) {
        return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }
    if ((hasStop && !ROAD_STOP_VALUES.includes(String(stop))) || (hasStop2 && !ROAD_STOP_VALUES.includes(String(stop2)))) {
        return res.status(400).json({ success: false, error: 'قيمة الحالة غير صالحة' });
    }

    try {
        const sets = [];
        const params = [];
        if (hasStop) { params.push(String(stop)); sets.push(`stop = $${params.length}`); }
        if (hasStop2) { params.push(String(stop2)); sets.push(`stop2 = $${params.length}`); }
        sets.push('updated_at = NOW()');
        params.push(id);

        const result = await servicesPool.query(
            `UPDATE public.service_all SET ${sets.join(', ')} WHERE id = $${params.length} AND discriminator = 'road_barriers'`,
            params
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'الحاجز غير موجود' });
        }
        broadcastLiveUpdate('status_updated', { layer: 'road_barriers' });
        res.json({ success: true });
    } catch (err) {
        console.error('❌ خطأ أثناء تحديث حالة الحاجز:', err.message);
        res.status(500).json({ success: false, error: 'فشل التحديث', details: IS_PROD ? undefined : err.message });
    }
});

// 🆕 🔒 للمشرف: تعديل جماعي لحالة عدة حواجز دفعة واحدة (المحددة فقط أو كلها)
app.post('/api/admin/bulk-update-road-barriers', requireAdmin, async (req, res) => {
    const { stop, stop2 } = req.body;
    const ids = parseIdList(req.body.ids);
    const hasStop = hasStatusValue(stop);
    const hasStop2 = hasStatusValue(stop2);

    if (ids.length === 0) {
        return res.status(400).json({ success: false, error: 'لم يتم تحديد أي حاجز' });
    }
    if (!hasStop && !hasStop2) {
        return res.status(400).json({ success: false, error: 'اختر حالة للداخل و/أو للخارج' });
    }
    if ((hasStop && !ROAD_STOP_VALUES.includes(String(stop))) || (hasStop2 && !ROAD_STOP_VALUES.includes(String(stop2)))) {
        return res.status(400).json({ success: false, error: 'قيمة الحالة غير صالحة' });
    }

    try {
        const params = [ids];
        const sets = [];
        if (hasStop) { params.push(String(stop)); sets.push(`stop = $${params.length}`); }
        if (hasStop2) { params.push(String(stop2)); sets.push(`stop2 = $${params.length}`); }
        sets.push('updated_at = NOW()');

        const result = await servicesPool.query(
            `UPDATE public.service_all SET ${sets.join(', ')} WHERE discriminator = 'road_barriers' AND id = ANY($1)`,
            params
        );
        broadcastLiveUpdate('status_updated', { layer: 'road_barriers' });
        res.json({ success: true, updated: result.rowCount });
    } catch (err) {
        console.error('❌ خطأ أثناء التعديل الجماعي لحواجز الطرق:', err.message);
        res.status(500).json({ success: false, error: 'فشل التحديث الجماعي', details: IS_PROD ? undefined : err.message });
    }
});

// 🆕 🔒 للمشرف: تعديل جماعي لتوفر الوقود لعدة محطات دفعة واحدة (المحددة فقط أو كلها)
app.post('/api/admin/bulk-update-fuel-stations', requireAdmin, async (req, res) => {
    const ids = parseIdList(req.body.ids);
    if (ids.length === 0) {
        return res.status(400).json({ success: false, error: 'لم يتم تحديد أي محطة' });
    }

    const params = [ids];
    const sets = [];
    for (const col of ['diesel', 'banzen95', 'banzen98']) { // أسماء أعمدة ثابتة (ليست من المستخدم)
        const val = req.body[col];
        if (!hasStatusValue(val)) continue;
        if (!FUEL_AVAIL_VALUES.includes(String(val))) {
            return res.status(400).json({ success: false, error: 'قيمة التوفر غير صالحة' });
        }
        params.push(String(val));
        sets.push(`${col} = $${params.length}`);
    }
    if (sets.length === 0) {
        return res.status(400).json({ success: false, error: 'اختر توفر نوع وقود واحد على الأقل' });
    }
    sets.push('updated_at = NOW()');

    try {
        const result = await servicesPool.query(
            `UPDATE public.service_all SET ${sets.join(', ')} WHERE discriminator = 'fuel_stations' AND id = ANY($1)`,
            params
        );
        broadcastLiveUpdate('status_updated', { layer: 'fuel_stations' });
        res.json({ success: true, updated: result.rowCount });
    } catch (err) {
        console.error('❌ خطأ أثناء التعديل الجماعي لمحطات الوقود:', err.message);
        res.status(500).json({ success: false, error: 'فشل التحديث الجماعي', details: IS_PROD ? undefined : err.message });
    }
});

// 🔒 للمشرف: تحديث توفر الوقود لمحطة واحدة
app.post('/api/admin/update-fuel-station', requireAdmin, async (req, res) => {
    const { id, diesel, banzen95, banzen98 } = req.body;
    if (id === undefined) {
        return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }
        try {
        await servicesPool.query(
            `UPDATE public.service_all SET diesel = $1, banzen95 = $2, banzen98 = $3, updated_at = NOW() WHERE id = $4 AND discriminator = 'fuel_stations'`,
            [diesel, banzen95, banzen98, id]
        );
        broadcastLiveUpdate('status_updated', { layer: 'fuel_stations' });
        res.json({ success: true });
    } catch (err) {
        console.error('❌ خطأ أثناء تحديث حالة المحطة:', err.message);
        res.status(500).json({ success: false, error: 'فشل التحديث', details: IS_PROD ? undefined : err.message });
    }
});

// 🆕 🔒 للمشرف: "حفظ الكل" لحواجز الطرق - كل حاجز معدَّل بقيمه الخاصة، ضمن معاملة واحدة (كلها أو لا شيء)
// body: { items: [ { id, stop?, stop2? }, ... ] }
app.post('/api/admin/batch-update-road-barriers', requireAdmin, async (req, res) => {
    const rawItems = Array.isArray(req.body.items) ? req.body.items.slice(0, 2000) : [];
    const clean = [];

    for (const it of rawItems) {
        const id = parseInt(it && it.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, error: 'معرّف حاجز غير صالح' });
        }
        const hasStop = hasStatusValue(it.stop);
        const hasStop2 = hasStatusValue(it.stop2);
        if (!hasStop && !hasStop2) continue; // لا شيء لتحديثه لهذا الحاجز
        if ((hasStop && !ROAD_STOP_VALUES.includes(String(it.stop))) || (hasStop2 && !ROAD_STOP_VALUES.includes(String(it.stop2)))) {
            return res.status(400).json({ success: false, error: 'قيمة الحالة غير صالحة' });
        }
        clean.push({ id, stop: hasStop ? String(it.stop) : null, stop2: hasStop2 ? String(it.stop2) : null });
    }

    if (clean.length === 0) {
        return res.status(400).json({ success: false, error: 'لا توجد تعديلات للحفظ' });
    }

    const client = await servicesPool.connect();
    try {
        await client.query('BEGIN');
        let updated = 0;
        for (const it of clean) {
            const sets = [];
            const params = [];
            if (it.stop !== null) { params.push(it.stop); sets.push(`stop = $${params.length}`); }
            if (it.stop2 !== null) { params.push(it.stop2); sets.push(`stop2 = $${params.length}`); }
            sets.push('updated_at = NOW()');
            params.push(it.id);
            const r = await client.query(
                `UPDATE public.service_all SET ${sets.join(', ')} WHERE id = $${params.length} AND discriminator = 'road_barriers'`,
                params
            );
            updated += r.rowCount;
        }
        await client.query('COMMIT');
        broadcastLiveUpdate('status_updated', { layer: 'road_barriers' });
        res.json({ success: true, updated });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (e) { /* تجاهل */ }
        console.error('❌ خطأ أثناء حفظ الكل لحواجز الطرق:', err.message);
        res.status(500).json({ success: false, error: 'فشل الحفظ، لم يُحفظ أي تعديل', details: IS_PROD ? undefined : err.message });
    } finally {
        client.release();
    }
});

// 🆕 🔒 للمشرف: "حفظ الكل" لمحطات الوقود - كل محطة معدَّلة بقيمها الخاصة، ضمن معاملة واحدة
// body: { items: [ { id, diesel?, banzen95?, banzen98? }, ... ] }
app.post('/api/admin/batch-update-fuel-stations', requireAdmin, async (req, res) => {
    const rawItems = Array.isArray(req.body.items) ? req.body.items.slice(0, 2000) : [];
    const FUEL_COLS = ['diesel', 'banzen95', 'banzen98']; // أسماء أعمدة ثابتة (ليست من المستخدم)
    const clean = [];

    for (const it of rawItems) {
        const id = parseInt(it && it.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, error: 'معرّف محطة غير صالح' });
        }
        const values = {};
        for (const col of FUEL_COLS) {
            if (!hasStatusValue(it[col])) continue;
            if (!FUEL_AVAIL_VALUES.includes(String(it[col]))) {
                return res.status(400).json({ success: false, error: 'قيمة التوفر غير صالحة' });
            }
            values[col] = String(it[col]);
        }
        if (Object.keys(values).length === 0) continue;
        clean.push({ id, values });
    }

    if (clean.length === 0) {
        return res.status(400).json({ success: false, error: 'لا توجد تعديلات للحفظ' });
    }

    const client = await servicesPool.connect();
    try {
        await client.query('BEGIN');
        let updated = 0;
        for (const it of clean) {
            const sets = [];
            const params = [];
            Object.keys(it.values).forEach(col => { params.push(it.values[col]); sets.push(`${col} = $${params.length}`); });
            sets.push('updated_at = NOW()');
            params.push(it.id);
            const r = await client.query(
                `UPDATE public.service_all SET ${sets.join(', ')} WHERE id = $${params.length} AND discriminator = 'fuel_stations'`,
                params
            );
            updated += r.rowCount;
        }
        await client.query('COMMIT');
        broadcastLiveUpdate('status_updated', { layer: 'fuel_stations' });
        res.json({ success: true, updated });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (e) { /* تجاهل */ }
        console.error('❌ خطأ أثناء حفظ الكل لمحطات الوقود:', err.message);
        res.status(500).json({ success: false, error: 'فشل الحفظ، لم يُحفظ أي تعديل', details: IS_PROD ? undefined : err.message });
    } finally {
        client.release();
    }
});

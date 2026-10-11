// A provider's own service: read it, change its status and location.
import { IS_PROD, app } from '../app.js';
import { servicesPool } from '../database.js';
import { REAL_ESTATE_LAYERS, getPoolForLayer, isValidLayer } from '../layers.js';
import { requireAuth } from '../auth.js';
import { isPropertyLayer, normalizeListingLayer, ownsListing, ownedListings } from '../listing-owners.js';

// =========================================================================
// مسار جلب الخدمة المربوطة بمزود الخدمة والتحقق من اكتمال الحقول مع الإحداثيات
// =========================================================================
app.get('/api/get-provider-service', requireAuth, async (req, res) => {
    const user_id = req.auth.uid; // 🔒 من التوكن وليس من الاستعلام

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'رقم المستخدم user_id مطلوب' });
    }

    try {
        // الاستعلام عن الحقول من جدول المستخدمين مباشرة مع جلب الرتبة
        const userQuery = `
            SELECT status, service_layer, feature_id
            FROM public.users 
            WHERE user_id = $1
        `;
        const result = await servicesPool.query(userQuery, [user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }

        const userRow = result.rows[0];

        const listings = await ownedListings(user_id);
        const primaryLayer = normalizeListingLayer(userRow.service_layer);
        const primaryId = Number(userRow.feature_id);
        listings.sort((a, b) => {
            const aPrimary = a.layer === primaryLayer && a.feature_id === primaryId;
            const bPrimary = b.layer === primaryLayer && b.feature_id === primaryId;
            return Number(bPrimary) - Number(aPrimary);
        });
        if (listings.length === 0) {
            return res.json({
                success: false,
                show_panel: false,
                message: 'الحساب ليس مزود خدمة مفعّل أو لا توجد إعلانات مرتبطة به.'
            });
        }

        const services = [];
        for (const listing of listings) {
            const discriminator = normalizeListingLayer(listing.layer);
            if (!discriminator || !isValidLayer(discriminator)) continue;
            const targetPool = getPoolForLayer(discriminator);
            const idField = isPropertyLayer(discriminator) ? 'fid' : 'id';
            const isRealEstate = isPropertyLayer(discriminator);
            const coordsQuery = isRealEstate
                ? discriminator === 'LandSale'
                    ? `SELECT name, ST_X(ST_PointOnSurface(geom)) AS x_coord, ST_Y(ST_PointOnSurface(geom)) AS y_coord, status
                       FROM public."${discriminator}" WHERE ${idField} = $1 LIMIT 1`
                    : `SELECT name, x_coord, y_coord, status FROM public."${discriminator}" WHERE ${idField} = $1 LIMIT 1`
                : `SELECT name, x_coord, y_coord, status FROM public.service_all WHERE id = $1 AND discriminator = $2 LIMIT 1`;
            const featureId = listing.feature_id;
            const coordsResult = await targetPool.query(
                coordsQuery,
                isRealEstate ? [featureId] : [featureId, discriminator]
            );
            const row = coordsResult.rows[0];
            if (row) {
                services.push({
                    service_layer: discriminator,
                    feature_id: featureId,
                    id: featureId,
                    name: row.name == null ? '' : String(row.name),
                    status: row.status,
                    x_coord: row.x_coord,
                    y_coord: row.y_coord
                });
            }
        }

        if (services.length === 0) {
            return res.json({ success: false, show_panel: false, message: 'لا توجد إعلانات نشطة مرتبطة بهذا الحساب.' });
        }

        res.json({
            success: true,
            show_panel: true,
            user_status: parseInt(userRow.status), // إرسال الحالة الإدارية (0 نشط، 1 مجمد)
            service: services[0],
            services
        });

    } catch (err) {
        console.error('❌ خطأ أثناء جلب بيانات خدمة المزود:', err.message);
        res.status(500).json({ success: false, error: 'خطأ داخلي في الخادم', details: IS_PROD ? undefined : err.message });
    }
});

// =========================================================================
// مسار تحديث الحالة والموقع الجغرافي الذكي (يدعم الخدمات والعقارات)
// =========================================================================
app.post('/api/update-service-status', requireAuth, async (req, res) => {
    const {
        user_id,
        service_layer,
        feature_id,
        id,
        status,
        x_coord,
        y_coord
    } = req.body;

    const targetIdValue = feature_id || id;
    const layerName = service_layer ? service_layer.trim() : null;

    if (!user_id || !layerName || !targetIdValue) {
        return res.status(400).json({ success: false, error: 'بيانات التحديث غير مكتملة، المعرفات والطبقة الجغرافية حقول إجبارية.' });
    }

    if (!isValidLayer(layerName)) {
        return res.status(403).json({ success: false, error: 'غير مسموح بالتعامل مع هذه الطبقة برمجياً' });
    }

    const parsedStatus = status !== undefined ? parseInt(status, 10) : 0;
    if (![0, 1].includes(parsedStatus)) {
        return res.status(400).json({ success: false, error: 'قيمة الحالة يجب أن تكون 0 (متوفر) أو 1 (غير متوفر).' });
    }
    const parsedXCoord = x_coord ? Number(x_coord) : null;
    const parsedYCoord = y_coord ? Number(y_coord) : null;

    // مصفوفة طبقات العقارات لتحديد السلوك برمجياً
    const isRealEstate = REAL_ESTATE_LAYERS.includes(layerName);
    if (isPropertyLayer(layerName) && (x_coord !== undefined || y_coord !== undefined)) {
        return res.status(400).json({ success: false, error: 'لا يمكن لمزود الخدمة تغيير موقع العقار.' });
    }

        try {
        // 🔒 لا يستطيع المستخدم تعديل إلا المعلم المربوط بحسابه فعلاً
        if (Number(user_id) !== req.auth.uid) {
            return res.status(403).json({ success: false, error: 'غير مصرح.' });
        }
        const ownerResult = await servicesPool.query(
            'SELECT role, is_active FROM public.users WHERE user_id = $1',
            [req.auth.uid]
        );
        const owner = ownerResult.rows[0];
        // any listing of this account (listing_owners), not only the first one
        const ownedLayer = normalizeListingLayer(layerName);
        if (!owner || owner.role !== 'provider' || !owner.is_active || !ownedLayer ||
            !/^\d+$/.test(String(targetIdValue)) ||
            !(await ownsListing(req.auth.uid, ownedLayer, targetIdValue))) {
            return res.status(403).json({ success: false, error: 'هذا المعلم غير مرتبط بحسابك.' });
        }

        const targetPool = getPoolForLayer(layerName);
        let updateLayerQuery = '';
        let queryParams = [];

        const idField = isPropertyLayer(layerName) ? 'fid' : 'id';
        // 🆕 اسم الجدول الفعلي: للعقارات يبقى نفس اسم الطبقة، ولكل الخدمات service_all
        const tableName = isRealEstate ? `"${layerName}"` : `service_all`;
        // 🆕 شرط إضافي على discriminator (فقط للخدمات) — نضيفه بنهاية كل استعلام لاحقاً
        const discriminatorWhere = isRealEstate ? '' : ` AND discriminator = $__DISC__`;

        // التحقق مما إذا كان الطلب يتضمن إحداثيات جديدة
        if (parsedXCoord && parsedYCoord && parsedXCoord > 100000) {

            if (isRealEstate && layerName !== 'Location') {
                console.log(`🏢 تحديث عقار/مضلع: Layer=[${layerName}], ID=[${targetIdValue}]`);
                updateLayerQuery = `
                    UPDATE public.${tableName}
                    SET
                        status = $1,
                        x_coord = $2,
                        y_coord = $3
                    WHERE ${idField} = $4${discriminatorWhere}
                `;
                queryParams = [parsedStatus, parsedXCoord, parsedYCoord, targetIdValue];
            } else {
                console.log(`🟢 تحديث نقطة/خدمة: Layer=[${layerName}], ID=[${targetIdValue}]`);
                updateLayerQuery = `
                    UPDATE public.${tableName}
                    SET
                        status = $1,
                        x_coord = $2::float8,
                        y_coord = $3::float8,
                        geom = ST_SetSRID(ST_MakePoint($2, $3), 28191)
                    WHERE ${idField} = $4${discriminatorWhere}
                `;
                queryParams = [parsedStatus, parsedXCoord, parsedYCoord, targetIdValue];
            }
        } else {
            console.log(`📍 تحديث حالة فقط: Layer=[${layerName}], ID=[${targetIdValue}]`);
            updateLayerQuery = `
                UPDATE public.${tableName}
                SET status = $1
                WHERE ${idField} = $2${discriminatorWhere}
            `;
            queryParams = [parsedStatus, targetIdValue];
        }

        // 🆕 حقن رقم الـ parameter الصحيح لـ discriminator في نهاية القائمة (فقط للخدمات)
        if (!isRealEstate) {
            updateLayerQuery = updateLayerQuery.replace('$__DISC__', `$${queryParams.length + 1}`);
            queryParams.push(layerName);
        }

        // تنفيذ استعلام التحديث على قاعدة البيانات الصحيحة (العقارات أو الخدمات)
        const updateResult = await targetPool.query(updateLayerQuery, queryParams);

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'لم يتم العثور على الخدمة المرتبطة بهذا الحساب.' });
        }

        // 🔄 [مزامنة ذكية]: نقوم بتحديث جدول الـ users للخدمات والعقارات
        if (parsedXCoord && parsedYCoord) {
            const syncUserCoords = `UPDATE public.users SET x_coord = $1, y_coord = $2 WHERE user_id = $3`;
            await servicesPool.query(syncUserCoords, [parsedXCoord, parsedYCoord, user_id]);
            console.log(`🔄 تم تزامن إحداثيات مزود الخدمة في جدول المستخدمين.`);
        }

        console.log(`\x1b[36m%s\x1b[0m`, `🎯 [نجاح التحديث] تم تحديث البيانات بنجاح للطبقة [${layerName}] المعلم [${targetIdValue}]`);

        res.json({
            success: true, 
            status: parsedStatus,
            message: `تم تحديث الطبقة [${layerName}] بنجاح وتفادي تعارض هندسة المضلعات.` 
        });

    } catch (err) {
        console.error(`❌ خطأ أثناء تحديث الطبقة [${layerName}]:`, err.message);
        res.status(500).json({ 
            success: false, 
            error: 'فشل تحديث قاعدة البيانات الخلفية', 
            details: IS_PROD ? undefined : err.message 
        });
    }
});

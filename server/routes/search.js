// Search: unique field values and feature search (single and batch).
import { IS_PROD, app, debugLog } from '../app.js';
import { realestatePool, servicesPool } from '../database.js';
import { REAL_ESTATE_LAYERS, isValidLayer, isValidSqlIdentifier } from '../layers.js';
import { activeAdminUidFromToken, bearerToken } from '../auth.js';
import { AVAILABLE_FIRST_SQL, hiddenDiscriminators, isLayerHidden, publicListingSql } from '../../lib/listing-rules.js';
import { hiddenLayersFor } from '../visibility.js';

const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] };

// 8. API لجلب القيم الفريدة من PostgreSQL مباشرة (أسرع من GeoServer)
app.get('/api/get-unique-values', async (req, res) => {
    try {
        const { layer, workspace, field } = req.query;
        if (!layer || !workspace || !field) return res.status(400).json({ error: 'layer, workspace, and field are required' });
        if (!isValidLayer(layer)) return res.status(403).json({ error: 'اسم طبقة غير مسموح به.' });
        if (!isValidSqlIdentifier(field)) return res.status(400).json({ error: 'اسم حقل غير صالح.' });

        const targetPool = workspace === 'realestate' ? realestatePool : servicesPool;
        // 🆕 تحديد الجدول الفعلي: العقارات بجدولها الخاص، وكل الخدمات أصبحت service_all
        const isRealEstate = REAL_ESTATE_LAYERS.includes(layer.trim());
        const tableName = isRealEstate ? `"${layer}"` : `service_all`;
        // طبقة أخفاها المشرف لا تظهر قيمها لغيره
        if (isLayerHidden(layer, await hiddenLayersFor(req))) return res.json({ success: true, values: [] });

        // 🆕 فلترة تسلسلية اختيارية: filter_gov_a=... / filter_village_a=...
        let extraWhere = '';
        const extraParams = [];

        // 🆕 كل الخدمات (وليس العقارات) لازم تُفلتر بعمود discriminator أولاً
        if (!isRealEstate) {
            extraParams.push(layer.trim());
            extraWhere += ` AND discriminator = $${extraParams.length}`;
        }

        Object.keys(req.query).forEach(key => {
            if (key.startsWith('filter_')) {
                const filterField = key.substring('filter_'.length);
                const filterValue = req.query[key];
                if (isValidSqlIdentifier(filterField) && filterField !== field && filterValue) {
                    extraParams.push(filterValue);
                    extraWhere += ` AND "${filterField}" = $${extraParams.length}`;
                }
            }
        });

        const query = `SELECT DISTINCT "${field}" FROM public.${tableName} WHERE ${publicListingSql(isRealEstate)} AND "${field}" IS NOT NULL AND "${field}"::text != ''${extraWhere} ORDER BY "${field}" ASC LIMIT 10000`;
        const result = await targetPool.query(query, extraParams);
        const values = result.rows.map(row => row[field]).filter(v => v != null && v !== '');
        res.json({ success: true, values });
    } catch (error) {
        res.status(500).json({ error: 'Database query failed', details: IS_PROD ? undefined : error.message });
    }
});

// 🆕 [تحسين أداء]: جلب عدة معالم من نفس الطبقة دفعة واحدة بمعرفاتهم،
// بدل استعلام منفصل لكل معلم (يُستخدم بأقسام "الأعلى تقييماً"/"موصى بهم")
app.post('/api/search-features-batch', async (req, res) => {
    try {
        const { layer, workspace, ids } = req.body;
        if (!layer || !workspace || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'layer, workspace, ids مطلوبة' });
        }
        if (!isValidLayer(layer)) return res.status(403).json({ error: 'اسم طبقة غير مسموح به.' });

        const targetPool = workspace === 'realestate' ? realestatePool : servicesPool;
        const isRealEstate = REAL_ESTATE_LAYERS.includes(layer);
        const tableName = isRealEstate ? `"${layer}"` : `service_all`;
        const idField = isRealEstate ? 'fid' : 'id';

        // سقف لعدد المعرفات: الأقسام تطلب بضع عشرات فقط
        const cleanIds = ids.slice(0, 100).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (cleanIds.length === 0) return res.json(EMPTY_COLLECTION);
        if (isLayerHidden(layer, await hiddenLayersFor(req))) return res.json(EMPTY_COLLECTION);

        // نفس قاعدة الظهور العامة: لا يظهر المسحوب أو المنتهي في "الأعلى تقييماً" و"موصى بهم"
        let query = `SELECT *, ST_AsGeoJSON(geom) as geom_json FROM public.${tableName} WHERE ${idField} = ANY($1) AND ${publicListingSql(isRealEstate)}`;
        const params = [cleanIds];

        if (!isRealEstate) {
            query += ` AND discriminator = $2`;
            params.push(layer.trim());
        }

        const result = await targetPool.query(query, params);
        const features = result.rows.map(row => {
            const { x_coord, y_coord, geom, geom_json, ...properties } = row;
            let geometry;
            if (row.geom_json) {
                try { geometry = JSON.parse(row.geom_json); } catch (e) { geometry = null; }
            }
            if (!geometry) {
                geometry = { type: 'Point', coordinates: [Number(x_coord), Number(y_coord)] };
            }
            return { type: 'Feature', geometry, properties };
        });

        res.json({ type: 'FeatureCollection', features });
    } catch (error) {
        console.error('Batch Search API Error:', error.message);
        res.status(500).json({ error: 'Database query failed', details: IS_PROD ? undefined : error.message });
    }
});


// 9. API للبحث مع فلترة مكانية BBOX (لعمليات البحث الأربعة)
app.get('/api/search-features', async (req, res) => {
    try {
        const { layer, workspace, field, operator, value, bbox, layerNameAr, conditions_count } = req.query;

        if (!layer || !workspace) {
            return res.status(400).json({ error: 'layer and workspace are required' });
        }

        // 🆕 [إصلاح ثغرة SQL Injection]: layer وأسماء الحقول (field / field_N) كانت
        // تُدمَج مباشرة داخل نص الاستعلام بدون أي تحقق - أخطر نقطة كانت حلقة
        // field_${i} القادمة مباشرة من query params العميل. الآن نتحقق من كل
        // اسم حقل ضد نمط معرّف SQL عادي، ونتجاهل أي شرط لا يطابقه بدل تنفيذه.
        if (!isValidLayer(layer)) {
            return res.status(403).json({ error: 'اسم طبقة غير مسموح به.' });
        }

        const targetPool = workspace === 'realestate' ? realestatePool : servicesPool;
        const isRealEstate = REAL_ESTATE_LAYERS.includes(layer);
        const isPolygonLayer = layer === 'LandSale'; // الأراضي هي مضلعات
        // 🆕 اسم الجدول الفعلي: العقارات بجدولها الخاص، وكل الخدمات أصبحت service_all
        const tableName = isRealEstate ? `"${layer}"` : `service_all`;

        // 🔒 عرض السجلات غير الفعّالة/المنتهية للمشرف فقط؛ لغيره يُتجاهل المعامل وتُطبَّق الفلترة العادية
        const ignoreStatusFilter = req.query.ignore_status === '1' && !!(await activeAdminUidFromToken(bearerToken(req)));

        let query = `SELECT *, ST_AsGeoJSON(geom) as geom_json FROM public.${tableName} WHERE 1=1`;
        const params = [];

        // 🆕 استثناء خاص: layer === 'service_all' يعني طلب كل الخدمات دفعة واحدة
        // (يُستخدم فقط بالبحث العالمي لتوحيد 66 طلباً منفصلاً بطلب واحد)
        if (!isRealEstate && layer.trim() !== 'service_all') {
            params.push(layer.trim());
            query += ` AND discriminator = $${params.length}`;
        }

        // 🔒 طبقة أخفاها المشرف (إعداد الإظهار والإخفاء) لا تُرجَع لغيره، ولا أنواعها ضمن service_all
        const hidden = await hiddenLayersFor(req);
        if (isLayerHidden(layer, hidden)) return res.json(EMPTY_COLLECTION);
        if (layer.trim() === 'service_all') {
            const hiddenTypes = hiddenDiscriminators(hidden);
            if (hiddenTypes.length) {
                params.push(hiddenTypes);
                query += ` AND NOT (discriminator = ANY($${params.length}::text[]))`;
            }
        }

        // متوفر + غير متوفر مؤقتاً (للخدمات) يظهران، المسحوب والمنتهي لا (lib/listing-rules.js)
        if (!ignoreStatusFilter) {
            query += ` AND ${publicListingSql(isRealEstate)}`;
        }

        // إضافة فلترة مكانية BBOX إذا تم توفيرها
        if (bbox) {
            const [minX, minY, maxX, maxY] = bbox.split(',').map(Number);
            if (isPolygonLayer) {
                // للمضلعات: استخدام ST_Intersects مع المربع المكاني
                query += ` AND ST_Intersects(ST_MakeEnvelope($${params.length + 1}, $${params.length + 2}, $${params.length + 3}, $${params.length + 4}, 28191), geom)`;
                params.push(minX, minY, maxX, maxY);
            } else {
                // للنقاط: استخدام x_coord و y_coord
                query += ` AND x_coord >= $${params.length + 1} AND x_coord <= $${params.length + 2}`;
                params.push(minX, maxX);
                query += ` AND y_coord >= $${params.length + 1} AND y_coord <= $${params.length + 2}`;
                params.push(minY, maxY);
            }
        }

                // 🆕 معالجة الشروط المتعددة بمنطق منطقي حقيقي: نجمع الشروط في "مجموعات" -
        // داخل نفس المجموعة يتم الربط بـ OR، وبين المجموعات المختلفة يتم الربط بـ AND.
        // حقل حالة الحاجز (stop) يُجمَّع تلقائياً مع نفسه (نفس الحقل) فتصبح عدة قيم
        // مختارة له (مفتوح/مغلق/أزمة...) بمنطق OR أيضاً. باقي الحقول (السعر، المنطقة،
        // الاسم، وحالات الوقود) تبقى AND تماماً كما كانت، لأنها مجموعات منفصلة عن بعضها.
        function getConditionGroupKey(fieldName) {
            return fieldName;
        }

        // 🔒 سقف لعدد الشروط: الحلقة أدناه متزامنة، وقيمة ضخمة من زائر (conditions_count=300000000) كانت تجمّد السيرفر كله.
        // أكبر استعمال حقيقي بالواجهات بضعة شروط (حقول الفلترة + العملة + رقائق البحث الذكي).
        const MAX_SEARCH_CONDITIONS = 30;
        const count = Math.min(parseInt(conditions_count) || 0, MAX_SEARCH_CONDITIONS);
        const rawConditions = [];
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const condField = req.query[`field_${i}`];
                const condOperator = req.query[`operator_${i}`];
                const condValue = req.query[`value_${i}`];
                if (!isValidSqlIdentifier(condField)) continue;
                if (condField && condValue !== undefined && condValue !== '') {
                    rawConditions.push({ field: condField, operator: condOperator, value: String(condValue).trim() });
                }
            }
        } else if (field && value && isValidSqlIdentifier(field)) {
            rawConditions.push({ field, operator, value: String(value).trim() });
        }

        const groupedConditions = {};
        rawConditions.forEach(c => {
            const groupKey = getConditionGroupKey(c.field);
            if (!groupedConditions[groupKey]) groupedConditions[groupKey] = [];
            groupedConditions[groupKey].push(c);
        });

        Object.keys(groupedConditions).forEach(groupKey => {
            const orParts = [];
            groupedConditions[groupKey].forEach(c => {
                const fieldName = c.field;
                if (c.operator === '=') {
                    orParts.push(`${fieldName} = $${params.length + 1}`);
                    params.push(c.value);
                } else if (c.operator === 'contains') {
                    const NORM_FROM = 'أإآةهىيؤئء';
                    const NORM_TO   = 'اااههييءءء';
                    if (fieldName === 'search_tags') {
                    const searchColumns = isRealEstate ? ['search_tags', 'des'] : ['search_tags', 'des', 'name'];
                    const words = c.value.split(/\s+/).filter(w => w.length > 0);
                    const wordGroups = words.map(word => {
                        const colParts = searchColumns.map(col => {
                            params.push(`%${word}%`);
                            return `translate(${col}::text, '${NORM_FROM}', '${NORM_TO}') ILIKE translate($${params.length}, '${NORM_FROM}', '${NORM_TO}')`;
                        });
                        if (layerNameAr) {
                            params.push(layerNameAr);
                            params.push(`%${word}%`);
                            colParts.push(`translate($${params.length - 1}, '${NORM_FROM}', '${NORM_TO}') ILIKE translate($${params.length}, '${NORM_FROM}', '${NORM_TO}')`);
                        }
                        return `(${colParts.join(' OR ')})`;
                    });
                    if (wordGroups.length > 0) orParts.push(`(${wordGroups.join(' OR ')})`);
                } else {
                    params.push(`%${c.value}%`);
                    orParts.push(`translate(${fieldName}::text, '${NORM_FROM}', '${NORM_TO}') ILIKE translate($${params.length}, '${NORM_FROM}', '${NORM_TO}')`);
                }
                                  } else if (c.operator === '>') {
                    orParts.push(`CAST(${fieldName} AS NUMERIC) >= $${params.length + 1}`);
                    params.push(parseFloat(c.value));
                } else if (c.operator === '<') {
                    orParts.push(`CAST(${fieldName} AS NUMERIC) <= $${params.length + 1}`);
                    params.push(parseFloat(c.value));
                } else if (c.operator === 'notempty') {
                    // 🆕 [قسم الصور/الفيديوهات/قبل وبعد]: شرط "الحقل غير فارغ"
                    // يُستخدم لجلب أي معلم (خدمة أو عقار) يملك قيمة حقيقية بعمود
                    // pic أو video أو details_link_1/details_link_2، بغض النظر
                    // عن قيمة العمود نفسها. لا حاجة لأي parameter إضافي هنا.
                    orParts.push(`(${fieldName} IS NOT NULL AND ${fieldName}::text != '')`);
                }
            });
            if (orParts.length > 0) {
                query += ` AND (${orParts.join(' OR ')})`;
            }
        });

        if (layer === 'road_barriers' || layer === 'fuel_stations') {
            query += ` ORDER BY display_order NULLS LAST, id ASC LIMIT 2000`;
        } else {
            // المتاح الآن أولاً، ثم المغلق / غير المتوفر، وداخل كل منهما الأعلى تقييماً
            query += ` ORDER BY ${AVAILABLE_FIRST_SQL}, rating DESC NULLS LAST LIMIT 2000`;
        }

        debugLog(`Search Query for ${layer}:`, query);
        debugLog(`Search Params:`, params);

        const result = await targetPool.query(query, params);
        // تحويل النتائج إلى GeoJSON
        // تحويل النتائج إلى GeoJSON
        const features = result.rows.map(row => {
            let geometry;

            if (isPolygonLayer && row.geom_json) {
                // للمضلعات: استخدام geom_json (GeoJSON من PostGIS)
                geometry = JSON.parse(row.geom_json);
            } else {
                // للنقاط: استخدام x_coord و y_coord أولاً
                let xVal = (row.x_coord !== null && row.x_coord !== undefined) ? Number(row.x_coord) : null;
                let yVal = (row.y_coord !== null && row.y_coord !== undefined) ? Number(row.y_coord) : null;

                // 🆕 [إصلاح]: بعض الطبقات (مثل المُضافة حديثاً عبر استيراد مباشر
                // لقاعدة البيانات بدل نموذج الإضافة بالتطبيق) قد تملك عمود geom
                // الحقيقي (PostGIS) معبّأً، لكن عمودي x_coord/y_coord فارغين
                // (NULL) لأنه لا أحد مرّ بها عبر النموذج الذي يعبّئهما تلقائياً.
                // في هذه الحالة نستخرج الإحداثيات احتياطياً من geom_json نفسه
                // بدل إرجاع [null, null] التي تكسر زر "الانتقال إلى الخريطة".
                if ((xVal === null || xVal === undefined) && row.geom_json) {
                    try {
                        const parsedGeom = JSON.parse(row.geom_json);
                        if (parsedGeom && parsedGeom.type === 'Point' && Array.isArray(parsedGeom.coordinates)) {
                            xVal = parsedGeom.coordinates[0];
                            yVal = parsedGeom.coordinates[1];
                        }
                    } catch (e) { /* تجاهل خطأ التحليل، ستبقى القيم كما هي */ }
                }

                geometry = {
                    type: 'Point',
                    coordinates: [xVal, yVal]
                };
            }
            // إزالة الحقول الهندسية من الخصائص
            const { x_coord, y_coord, geom, geom_json, ...properties } = row;

            return {
                type: 'Feature',
                geometry: geometry,
                properties: properties
            };
        });

        res.json({
            type: 'FeatureCollection',
            features: features
        });

    } catch (error) {
        console.error('Search API Error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Database query failed', details: IS_PROD ? undefined : error.message });
    }
});

// Service requests between a user and a provider: request, answer, chat, confirm, rate; contact clicks.
import { IS_PROD, app } from '../app.js';
import { servicesPool } from '../database.js';
import { LAYER_AR_NAMES, REAL_ESTATE_LAYERS, getPoolForLayer, isValidLayer } from '../layers.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { getSocketIdForUser } from '../state.js';
import { isLayerHidden } from '../../lib/listing-rules.js';
import { getHiddenLayers } from '../visibility.js';
import { listingProvider, ready as ownersReady } from '../listing-owners.js';
import { appointmentText, parseAppointment } from '../../lib/appointment.js';

// =========================================================================
// 🆕 نظام طلب الخدمة + الدردشة + تسجيل عمليات النجاح (Backend Server)
// =========================================================================


// 🆕 استخراج رقم محلي من رقم واتساب دولي (00970598512667 -> 0598512667)
// نفس المنطق المستخدم بالضبط في popup.js و service-chat.js لضمان التطابق
function deriveLocalPhoneFromWhatsapp(rawWhatsapp) {
    if (!rawWhatsapp) return null;
    const digits = String(rawWhatsapp).replace(/\D/g, '');
    if (digits.length <= 5) return digits || null; // رقم قصير جداً، أعده كما هو تحسباً
    return '0' + digits.slice(5);
}

// 🆕 جلب بيانات تواصل مزود الخدمة (هاتف + واتساب) من جدول طبقة الخدمة نفسها
// (مثلاً public."electrician")، وليس من جدول users نهائياً - لأن جدول users
// لا يملك عمود whatsapp أصلاً، وبيانات التواصل الحقيقية لمزود الخدمة مخزنة
// بجدول الطبقة الجغرافية المرتبط بها (service_layer + feature_id).
// أرقام المزود بعد الاتفاق: من معلمه على الخريطة أولاً، وإن خلا المعلم من رقم فمن حسابه (هاتف/واتساب الحساب)،
// كما تصل أرقام حساب المستخدم للمزود. بدون هذا كان المستخدم يرى "أرقام التواصل غير متوفرة" لمعلم بلا رقم.
async function getProviderContactInfo(serviceLayer, featureId, providerUserId) {
    const fromFeature = await getFeatureContactInfo(serviceLayer, featureId);
    if ((fromFeature.phone && fromFeature.whatsapp) || !providerUserId) return fromFeature;
    try {
        const account = await servicesPool.query(
            'SELECT phone, whatsapp_number FROM public.users WHERE user_id = $1',
            [providerUserId]
        );
        const row = account.rows[0] || {};
        return {
            phone: fromFeature.phone || (row.phone ? String(row.phone).trim() : null),
            whatsapp: fromFeature.whatsapp || (row.whatsapp_number ? String(row.whatsapp_number).trim() : null)
        };
    } catch (err) {
        console.error('⚠️ خطأ أثناء جلب أرقام حساب المزود:', err.message);
        return fromFeature;
    }
}

async function getFeatureContactInfo(serviceLayer, featureId) {
    if (!serviceLayer || !featureId || !isValidLayer(serviceLayer)) {
        return { whatsapp: null, phone: null };
    }
    try {
        const isRealEstate = REAL_ESTATE_LAYERS.includes(serviceLayer.trim());
        const targetPool = getPoolForLayer(serviceLayer);

        // 🆕 الخدمات كلها بجدول service_all موحّد، فلازم فلترة إضافية بعمود discriminator
        const query = isRealEstate
            ? `SELECT whatsapp, phone FROM public."${serviceLayer}" WHERE fid = $1 LIMIT 1` // property tables key on fid
            : `SELECT whatsapp, phone FROM public.service_all WHERE id = $1 AND discriminator = $2 LIMIT 1`;
        const queryParams = isRealEstate ? [featureId] : [featureId, serviceLayer.trim()];

        const result = await targetPool.query(query, queryParams);
        if (result.rows.length === 0) return { whatsapp: null, phone: null };

        const rawWhatsapp = result.rows[0].whatsapp ? String(result.rows[0].whatsapp).trim() : null;
        const rawPhone = result.rows[0].phone ? String(result.rows[0].phone).trim() : null;
        return { whatsapp: rawWhatsapp, phone: rawPhone };
    } catch (err) {
        console.error(`⚠️ خطأ أثناء جلب بيانات تواصل مزود الخدمة من طبقة [${serviceLayer}]:`, err.message);
        return { whatsapp: null, phone: null };
    }
}

// 1) إنشاء طلب خدمة جديد (المستخدم يضغط "طلب الخدمة" بالبوب أب)
app.post('/api/service-requests', requireAuth, async (req, res) => {
    const { service_layer, feature_id, provider_name, service_type } = req.body;
    const user_id = req.auth.uid; // 🔒 من التوكن

    if (!user_id || !service_layer || !feature_id) {
        return res.status(400).json({ success: false, error: 'بيانات الطلب غير مكتملة.' });
    }
    if (!isValidLayer(service_layer)) {
        return res.status(403).json({ success: false, error: 'طبقة خدمة غير صالحة.' });
    }

    try {
        // The owner of this listing (an account may own several: listing_owners).
        const provider = await listingProvider(service_layer, feature_id);
        if (!provider) {
            return res.status(404).json({ success: false, error: 'تعذر العثور على حساب مزود الخدمة المرتبط بهذا المعلم.' });
        }

        if (Number(provider.user_id) === Number(user_id)) {
            return res.status(400).json({ success: false, error: 'لا يمكنك إرسال طلب خدمة لنفسك.' });
        }

        // 🔒 منع تكرار الطلب القائم (الضغط المزدوج والطلبات المتزامنة)
        const dupCheck = await servicesPool.query(
            `SELECT id FROM public.service_requests
             WHERE user_id = $1 AND provider_user_id = $2 AND service_layer = $3 AND feature_id = $4
               AND status IN ('pending', 'accepted') LIMIT 1`,
            [user_id, provider.user_id, service_layer, feature_id]
        );
        if (dupCheck.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'لديك طلب قائم بالفعل لهذا المزود.', existingId: dupCheck.rows[0].id });
        }

                                // 🆕 [إصلاح عرض اسم الطبقة بالعربي]: service_type المخزَّن هنا يجب أن
        // يكون بالعربي (نفس أسلوب طلبات "طلب الخدمة" الحقيقية)، وليس اسم الطبقة
        // الخام بالإنجليزية كما كان سابقاً، حتى يظهر بشكل صحيح لاحقاً في "طلباتي"
        const arabicServiceType = LAYER_AR_NAMES[service_layer] || service_layer;

        // 🆕 [إصلاح حرج]: هذا الاستعلام كان يستخدم متغيرات غير معرّفة إطلاقاً
        // (provider_user_id, final_provider_name, contact_type) منسوخة بالخطأ من
        // مسار /api/log-contact-click، وهذا كان يسبب ReferenceError وخطأ 500 فوري
        // مع كل ضغطة على زر "طلب الخدمة". كما أن حالة الطلب الجديد يجب أن تكون
        // 'pending' (بانتظار رد مزود الخدمة)، وليست 'completed' مباشرة.
        // 🔒 تنظيف القيم القادمة من العميل قبل تخزينها أو إرسالها
        const cleanClientName = (provider_name === undefined || provider_name === null)
            ? '' : String(provider_name).replace(/[<>]/g, '').trim().slice(0, 100);
        const finalProviderName = cleanClientName !== '' ? cleanClientName : provider.full_name;
        const safeServiceType = String(service_type || '').replace(/[<>]/g, '').trim().slice(0, 100);

        const insertResult = await servicesPool.query(
            `INSERT INTO public.service_requests (user_id, provider_user_id, service_layer, feature_id, provider_name, service_type, contact_type, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING id, created_at, status`,
            [user_id, provider.user_id, service_layer, feature_id, finalProviderName, arabicServiceType, 'service_request']
        );

        const newRequest = insertResult.rows[0];

        await servicesPool.query(
            `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at, link)
             VALUES ($1, $2, $3, 'info', false, NOW(), $4)`,
            [provider.user_id, '📩 طلب خدمة جديد', `لديك طلب خدمة جديد (${safeServiceType || service_layer}). يرجى فتح التطبيق للرد عليه.`, `request:${newRequest.id}`]
        );

        const providerSocketId = getSocketIdForUser(provider.user_id);
        console.log('📡 [NEW REQUEST] Provider ID:', provider.user_id, 'Socket ID:', providerSocketId);
        if (providerSocketId && global.io) {
            console.log('📡 [NEW REQUEST] Emitting service_request_new to socket:', providerSocketId);
            global.io.to(providerSocketId).emit('service_request_new', {
                id: newRequest.id,
                requestId: newRequest.id,
                serviceType: safeServiceType || service_layer,
                createdAt: newRequest.created_at
            });
        } else {
            console.log('⚠️ [NEW REQUEST] Provider not connected via socket');
        }

        res.json({ success: true, requestId: newRequest.id, status: newRequest.status });
    } catch (err) {
        console.error('❌ خطأ أثناء إنشاء طلب الخدمة:', err.message);
        if (err.code === '23505') { // 🔒 فهرس UNIQUE للطلبات القائمة
            return res.status(409).json({ success: false, error: 'لديك طلب قائم بالفعل لهذا المزود.' });
        }
        res.status(500).json({ success: false, error: 'فشل إنشاء طلب الخدمة', details: IS_PROD ? undefined : err.message });
    }
});

// 2) جلب الطلبات النشطة (المرسلة أو المستلمة) لمستخدم معين
app.get('/api/service-requests', requireAuth, async (req, res) => {
    const { user_id, provider_user_id, status } = req.query;
    // 🔒 كل مستخدم يرى طلباته فقط
    if ((user_id && Number(user_id) !== req.auth.uid) || (provider_user_id && Number(provider_user_id) !== req.auth.uid)) {
        return res.status(403).json({ success: false, error: 'غير مصرح لك بعرض هذه الطلبات.' });
    }

    if (!user_id && !provider_user_id) {
        return res.status(400).json({ success: false, error: 'user_id أو provider_user_id مطلوب' });
    }

    try {
        let query = `
            SELECT sr.*,
                   ru.full_name AS requester_name, ru.phone AS requester_phone, ru.whatsapp_number AS requester_whatsapp,
                   pu.full_name AS provider_full_name, pu.phone AS provider_phone, pu.whatsapp_number AS provider_whatsapp
            FROM public.service_requests sr
            LEFT JOIN public.users ru ON ru.user_id = sr.user_id
            LEFT JOIN public.users pu ON pu.user_id = sr.provider_user_id
            WHERE 1=1
        `;
        let params = [];
        let paramIndex = 1;

        if (provider_user_id) {
            query += ` AND sr.provider_user_id = $${paramIndex++}`;
            params.push(provider_user_id);
        } 
        
        if (user_id && !provider_user_id) {
            query += ` AND (sr.user_id = $${paramIndex++} OR sr.provider_user_id = $${paramIndex++})`;
            params.push(user_id, user_id);
        }

        if (status) {
            query += ` AND sr.status = $${paramIndex++}`;
            params.push(status);
        } else if (!provider_user_id) {
            query += ` AND sr.status IN ('pending', 'accepted', 'completed', 'cancelled', 'rejected')`;
        }

        query += ` ORDER BY sr.created_at DESC`;

        const result = await servicesPool.query(query, params);
        const requests = result.rows;

        // 🆕 تجهيز أرقام التواصل الصحيحة فقط للطلبات المكتملة (بعد "تم الاتفاق"):
        // - رقم هاتف المستخدم الطالب: من عمود phone بجدول users كما هو تماماً.
        // - رقم واتساب المستخدم الطالب: من عمود whatsapp_number بجدول users.
        // - رقم هاتف وواتساب مزود الخدمة: من جدول طبقة الخدمة نفسها (عمود whatsapp)
        await Promise.all(requests.map(async (r) => {
            if (r.status === 'completed') {
                const providerContact = await getProviderContactInfo(r.service_layer, r.feature_id, r.provider_user_id);
                r.userPhone = r.requester_phone || null;
                r.userWhatsapp = r.requester_whatsapp || null;
                r.providerPhone = providerContact.phone;
                r.providerWhatsapp = providerContact.whatsapp;
            } else {
                // 🔒 الأرقام لا تُرسل إلا بعد اكتمال الاتفاق
                r.requester_phone = null;
                r.requester_whatsapp = null;
                r.provider_phone = null;
                r.provider_whatsapp = null;
            }
            // 🆕 اسم الطرف الآخر بشكل موحّد لواجهة "طلباتي النشطة"
            r.user_name = r.requester_name;
        }));

        res.json({ success: true, requests });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب طلبات الخدمة:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب الطلبات', details: IS_PROD ? undefined : err.message });
    }
});

// 3) رد مزود الخدمة على الطلب (قبول / رفض)
app.post('/api/service-requests/:id/respond', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { action } = req.body;
    const provider_user_id = req.auth.uid; // 🔒 من التوكن

    if (!provider_user_id || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, error: 'بيانات الرد غير صالحة.' });
    }
    // Accepting may set the time of the visit / viewing at once (optional; either side can set it later).
    const appointment = action === 'accept' && req.body.appointment_at !== undefined
        ? parseAppointment(req.body.appointment_at) : { value: null };
    if (appointment.error) return res.status(400).json({ success: false, error: appointment.error });

    try {
        const reqResult = await servicesPool.query('SELECT * FROM public.service_requests WHERE id = $1', [id]);
        if (reqResult.rows.length === 0) return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });

        const request = reqResult.rows[0];
        if (Number(request.provider_user_id) !== Number(provider_user_id)) {
            return res.status(403).json({ success: false, error: 'لا تملك صلاحية الرد على هذا الطلب.' });
        }
        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, error: 'تم الرد على هذا الطلب مسبقاً.' });
        }

        const newStatus = action === 'accept' ? 'accepted' : 'rejected';
        const upd = await servicesPool.query(
            `UPDATE public.service_requests SET status = $1, updated_at = NOW(),
                    appointment_at = COALESCE($3, appointment_at) WHERE id = $2 AND status = 'pending'`,
            [newStatus, id, appointment.value]
        );
        if (upd.rowCount === 0) {
            return res.status(409).json({ success: false, error: 'تم الرد على هذا الطلب مسبقاً.' });
        }

        const title = action === 'accept' ? '✅ تم قبول طلبك' : '❌ تم رفض طلبك';
        const message = action === 'accept'
            ? `وافق مزود الخدمة على طلبك (${request.service_type}). يمكنك الآن الدردشة معه.`
                + (appointment.value ? ` الموعد: ${appointmentText(appointment.value)}.` : '')
            : `اعتذر مزود الخدمة عن طلبك (${request.service_type}).`;

        await servicesPool.query(
            `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at, link)
             VALUES ($1, $2, $3, $4, false, NOW(), $5)`,
            [request.user_id, title, message, action === 'accept' ? 'success' : 'error', `request:${Number(id)}`]
        );

        const userSocketId = getSocketIdForUser(request.user_id);
        console.log('📡 [RESPONSE] User ID:', request.user_id, 'Socket ID:', userSocketId);
        if (userSocketId && global.io) {
            console.log('📡 [RESPONSE] Emitting service_request_response to socket:', userSocketId);
            global.io.to(userSocketId).emit('service_request_response', {
                requestId: Number(id),
                status: newStatus,
                serviceType: request.service_type,
                providerName: request.provider_name
            });
        } else {
            console.log('⚠️ [RESPONSE] User not connected via socket');
        }

        res.json({ success: true, status: newStatus, appointment_at: appointment.value });
    } catch (err) {
        console.error('❌ خطأ أثناء الرد على طلب الخدمة:', err.message);
        res.status(500).json({ success: false, error: 'فشل تنفيذ الرد', details: IS_PROD ? undefined : err.message });
    }
});

// The time of the visit / viewing: either side sets or changes it (or clears it with null) while the request is open;
// the other side is told. A property is rated after its viewing like a service after its job (both confirm → rate).
app.post('/api/service-requests/:id/appointment', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, error: 'رقم الطلب غير صالح.' });
    const appointment = parseAppointment(req.body?.appointment_at);
    if (appointment.error) return res.status(400).json({ success: false, error: appointment.error });
    try {
        const found = await servicesPool.query(
            'SELECT user_id, provider_user_id, status, service_type FROM public.service_requests WHERE id = $1', [id]);
        const request = found.rows[0];
        const uid = req.auth.uid;
        if (!request || (Number(request.user_id) !== uid && Number(request.provider_user_id) !== uid)) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });
        }
        if (!['pending', 'accepted'].includes(request.status)) {
            return res.status(409).json({ success: false, error: 'لا يمكن تغيير موعد طلب مغلق.' });
        }
        // The owner fixes the time; before they accept, the requester may only propose it.
        if (request.status === 'pending' && Number(request.provider_user_id) === uid) {
            return res.status(409).json({ success: false, error: 'اقبل الطلب أولاً، ومعه حدّد الموعد.' });
        }
        await servicesPool.query(
            'UPDATE public.service_requests SET appointment_at = $1, updated_at = NOW() WHERE id = $2', [appointment.value, id]);

        const other = Number(request.user_id) === uid ? request.provider_user_id : request.user_id;
        const message = appointment.value
            ? `الموعد (${request.service_type}): ${appointmentText(appointment.value)}.`
            : `أُلغي الموعد المحدد (${request.service_type}).`;
        await servicesPool.query(
            `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at, link)
             VALUES ($1, '📅 موعد', $2, 'info', false, NOW(), $3)`,
            [other, message, `request:${id}`]
        );
        const socketId = getSocketIdForUser(other);
        if (socketId && global.io) {
            global.io.to(socketId).emit('service_request_appointment', { requestId: id, appointment_at: appointment.value });
        }
        res.json({ success: true, appointment_at: appointment.value });
    } catch (err) {
        console.error('❌ خطأ أثناء تحديد الموعد:', err.message);
        res.status(500).json({ success: false, error: 'تعذر حفظ الموعد', details: IS_PROD ? undefined : err.message });
    }
});

// The publisher's rating: the average over every rating of every listing the owner of this one has (an account may
// publish several services and properties). Public, like the listing's own ratings; no names.
app.get('/api/publisher-rating', async (req, res) => {
    const { service_layer, feature_id } = req.query;
    if (!service_layer || !/^\d+$/.test(String(feature_id || '')) || !isValidLayer(service_layer)) {
        return res.status(400).json({ success: false, error: 'يجب تحديد service_layer و feature_id.' });
    }
    try {
        const owner = await listingProvider(service_layer, Number(feature_id));
        if (!owner) return res.json({ success: true, publisher: false, averageRating: 0, totalRatings: 0, listings: 0 });
        await ownersReady;
        const [ratings, listings] = await Promise.all([
            servicesPool.query(
                `SELECT ROUND(AVG(rating)::numeric, 1) AS avg, COUNT(*)::int AS n
                 FROM public.service_ratings WHERE provider_user_id = $1`, [owner.user_id]),
            servicesPool.query('SELECT COUNT(*)::int AS n FROM public.listing_owners WHERE user_id = $1', [owner.user_id])
        ]);
        res.json({
            success: true,
            publisher: true,
            averageRating: ratings.rows[0].avg === null ? 0 : Number(ratings.rows[0].avg),
            totalRatings: ratings.rows[0].n,
            listings: listings.rows[0].n
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب تقييم الناشر:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب التقييم', details: IS_PROD ? undefined : err.message });
    }
});

// 🆕 3 مكرر) إلغاء الطلب من قبل المستخدم أو المزود
app.post('/api/service-requests/:id/cancel', requireAuth, async (req, res) => {
    const requestId = req.params.id;
    const { cancellation_reason } = req.body;
    const user_id = req.auth.uid; // 🔒 من التوكن 

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم مطلوب' });
    }

    // 🆕 [فرض إجباري]: خط دفاع أخير على مستوى السيرفر - لا يُقبل إلغاء أي
    // طلب بدون سبب حقيقي، حتى لو تم تجاوز الواجهة الأمامية بأي شكل
    const reasonText = cancellation_reason ? String(cancellation_reason).replace(/[<>]/g, '').trim().slice(0, 300) : '';
    if (!reasonText) {
        return res.status(400).json({ success: false, error: 'يجب كتابة سبب إلغاء الطلب، لا يمكن إتمام الإلغاء بدونه.' });
    }

    try {
        const reqCheck = await servicesPool.query(
            `SELECT * FROM public.service_requests WHERE id = $1`,
            [requestId]
        );

        if (reqCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        const sRequest = reqCheck.rows[0];
        const isOwner = String(sRequest.user_id) === String(user_id);
        const isProvider = String(sRequest.provider_user_id) === String(user_id);

        if (!isOwner && !isProvider) {
            return res.status(403).json({ success: false, error: 'عذراً، ليس لديك صلاحية إلغاء هذا الطلب.' });
        }
        if (!['pending', 'accepted'].includes(sRequest.status)) {
            return res.status(400).json({ success: false, error: 'لا يمكن إلغاء هذا الطلب في حالته الحالية.' });
        }

        const updateRes = await servicesPool.query(
            `UPDATE public.service_requests 
             SET status = 'cancelled', cancellation_reason = $1, updated_at = NOW() 
             WHERE id = $2 RETURNING *`,
            [reasonText, requestId]
        );

        const targetUserId = isOwner ? sRequest.provider_user_id : sRequest.user_id;
        await servicesPool.query(
            `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at, link)
             VALUES ($1, '⚠️ تم إلغاء الطلب', $2, 'error', false, NOW(), $3)`,
            [targetUserId, `تم إلغاء الطلب والسبب: ${reasonText}`, `request:${Number(requestId)}`]
        );

        const targetSocketId = getSocketIdForUser(targetUserId);
        if (targetSocketId && global.io) {
            global.io.to(targetSocketId).emit('service_request_cancelled', { 
                requestId: Number(requestId), 
                reason: reasonText 
            });
        }

        res.json({ success: true, request: updateRes.rows[0] });
    } catch (err) {
        console.error('❌ خطأ أثناء إلغاء الطلب:', err.message);
        res.status(500).json({ success: false, error: 'تعذر إلغاء الطلب', details: IS_PROD ? undefined : err.message });
    }
});

// 4) جلب رسائل الدردشة الخاصة بطلب معيّن + بيانات التواصل عند اكتمال الاتفاق
app.get('/api/service-requests/:id/messages', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const messagesResult = await servicesPool.query(
            'SELECT * FROM public.service_request_messages WHERE request_id = $1 ORDER BY created_at ASC',
            [id]
        );

        const requestResult = await servicesPool.query(
            'SELECT * FROM public.service_requests WHERE id = $1',
            [id]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        const request = requestResult.rows[0];
        // 🔒 المحادثة لا يراها إلا طرفا الطلب
        if (Number(request.user_id) !== req.auth.uid && Number(request.provider_user_id) !== req.auth.uid) {
            return res.status(403).json({ success: false, error: 'غير مصرح لك بعرض هذه المحادثة.' });
        }
        const responsePayload = {
            success: true,
            messages: messagesResult.rows,
            requestStatus: request.status
        };

        if (request.status === 'completed') {
            // 🆕 استخدام phone و whatsapp_number من جدول users
            const userContactResult = await servicesPool.query(
                'SELECT phone, whatsapp_number FROM public.users WHERE user_id = $1',
                [request.user_id]
            );
            const userPhone = userContactResult.rows[0]?.phone || null;
            const userWhatsapp = userContactResult.rows[0]?.whatsapp_number || null;
            const providerContact = await getProviderContactInfo(request.service_layer, request.feature_id, request.provider_user_id);

            responsePayload.userPhone = userPhone;
            responsePayload.userWhatsapp = userWhatsapp;
            responsePayload.providerPhone = providerContact.phone;
            responsePayload.providerWhatsapp = providerContact.whatsapp;
        }

        res.json(responsePayload);
    } catch (err) {
        res.status(500).json({ success: false, error: 'فشل جلب الرسائل', details: IS_PROD ? undefined : err.message });
    }
});
// 5) إرسال رسالة دردشة جديدة ضمن طلب مقبول
app.post('/api/service-requests/:id/message', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { sender_role, message } = req.body;
    const sender_id = req.auth.uid; // 🔒 من التوكن

    if (!sender_id || !message || !['user', 'provider'].includes(sender_role)) {
        return res.status(400).json({ success: false, error: 'بيانات الرسالة غير مكتملة.' });
    }

    const trimmedMsg = String(message).trim();
    if (trimmedMsg === '') {
        return res.status(400).json({ success: false, error: 'لا يمكن إرسال رسالة فارغة.' });
    }

    try {
        const reqResult = await servicesPool.query('SELECT * FROM public.service_requests WHERE id = $1', [id]);
        if (reqResult.rows.length === 0) return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });
        const request = reqResult.rows[0];

        if (request.status !== 'accepted') {
            return res.status(400).json({ success: false, error: 'الدردشة متاحة فقط بعد قبول الطلب.' });
        }

        const senderIdInRequest = sender_role === 'user' ? request.user_id : request.provider_user_id;
        if (Number(senderIdInRequest) !== Number(sender_id)) {
            return res.status(403).json({ success: false, error: 'لا تملك صلاحية إرسال رسالة بهذه المحادثة.' });
        }

        const insertResult = await servicesPool.query(
            `INSERT INTO public.service_request_messages (request_id, sender_role, sender_id, message)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, sender_role, sender_id, trimmedMsg.slice(0, 1000)]
        );
        const savedMessage = insertResult.rows[0];

        const otherUserId = sender_role === 'user' ? request.provider_user_id : request.user_id;
        const otherSocketId = getSocketIdForUser(otherUserId);
        if (otherSocketId && global.io) {
            global.io.to(otherSocketId).emit('service_request_message', { requestId: Number(id), message: savedMessage });
        }

        res.json({ success: true, message: savedMessage });
    } catch (err) {
        console.error('❌ خطأ أثناء إرسال رسالة الدردشة:', err.message);
        res.status(500).json({ success: false, error: 'فشل إرسال الرسالة', details: IS_PROD ? undefined : err.message });
    }
});

// 6) تأكيد الاتفاق من أحد الطرفين
app.post('/api/service-requests/:id/confirm', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const user_id = req.auth.uid; // 🔒 من التوكن

    if (!user_id || !['user', 'provider'].includes(role)) {
        return res.status(400).json({ success: false, error: 'بيانات التأكيد غير صالحة.' });
    }

    const client = await servicesPool.connect();
    let clientReleased = false;
    try {
        await client.query('BEGIN');

        const reqResult = await client.query('SELECT * FROM public.service_requests WHERE id = $1 FOR UPDATE', [id]);
        if (reqResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });
        }
        const request = reqResult.rows[0];

        if (request.status !== 'accepted' && request.status !== 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'لا يمكن التأكيد قبل قبول الطلب.' });
        }

        const expectedId = role === 'user' ? request.user_id : request.provider_user_id;
        if (Number(expectedId) !== Number(user_id)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, error: 'لا تملك صلاحية التأكيد على هذا الطلب.' });
        }

        const fieldToUpdate = role === 'user' ? 'user_confirmed' : 'provider_confirmed';
        await client.query(`UPDATE public.service_requests SET ${fieldToUpdate} = true, updated_at = NOW() WHERE id = $1`, [id]);

        const refreshed = (await client.query('SELECT * FROM public.service_requests WHERE id = $1', [id])).rows[0];

        if (refreshed.user_confirmed && refreshed.provider_confirmed && refreshed.status !== 'completed') {
            await client.query(`UPDATE public.service_requests SET status = 'completed', updated_at = NOW() WHERE id = $1`, [id]);
            await client.query('COMMIT');
            client.release();          // 🔒 نحرر الاتصال قبل أي استعلام آخر (كان يسبب تجمّد الـ pool)
            clientReleased = true;

            // 🆕 هاتف المستخدم الطالب من عمود phone بجدول users
            const userContactResult = await servicesPool.query(
                'SELECT phone, whatsapp_number FROM public.users WHERE user_id = $1',
                [refreshed.user_id]
            );
            const userPhone = userContactResult.rows[0]?.phone || null;
            const userWhatsapp = userContactResult.rows[0]?.whatsapp_number || null;

            // 🆕 هاتف وواتساب مزود الخدمة من جدول طبقة الخدمة نفسها (عمود whatsapp)
            const providerContact = await getProviderContactInfo(refreshed.service_layer, refreshed.feature_id, refreshed.provider_user_id);

            const payloadForUser = {
                requestId: Number(id),
                userPhone: userPhone,
                userWhatsapp: userWhatsapp,
                providerPhone: providerContact.phone,
                providerWhatsapp: providerContact.whatsapp 
            };
            const payloadForProvider = {
                requestId: Number(id),
                userPhone: userPhone,
                userWhatsapp: userWhatsapp
            };

            const userSocketId = getSocketIdForUser(refreshed.user_id);
            if (userSocketId && global.io) global.io.to(userSocketId).emit('service_request_completed', payloadForUser);

            const providerSocketId = getSocketIdForUser(refreshed.provider_user_id);
            if (providerSocketId && global.io) global.io.to(providerSocketId).emit('service_request_completed', payloadForProvider);

            await servicesPool.query(
                `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at, link)
                 VALUES ($1, '🎉 تم الاتفاق بنجاح', 'تم تبادل أرقام التواصل، بالتوفيق!', 'success', false, NOW(), $3),
                       ($2, '🎉 تم الاتفاق بنجاح', 'تم تبادل أرقام التواصل، بالتوفيق!', 'success', false, NOW(), $3)`,
                [refreshed.user_id, refreshed.provider_user_id, `request:${Number(refreshed.id)}`]
            );

            return res.json({ 
                success: true, 
                status: 'completed', 
                userPhone: userPhone, 
                userWhatsapp: userWhatsapp,
                providerPhone: providerContact.phone,
                providerWhatsapp: providerContact.whatsapp 
            });
        }

        await client.query('COMMIT');
        res.json({ success: true, status: refreshed.status, waitingOtherSide: true });
    } catch (err) {
        if (!clientReleased) { try { await client.query('ROLLBACK'); } catch (e) { /* تجاهل */ } }
        console.error('❌ خطأ أثناء تأكيد طلب الخدمة:', err.message);
        res.status(500).json({ success: false, error: 'فشل تنفيذ التأكيد', details: IS_PROD ? undefined : err.message });
    } finally {
        if (!clientReleased) client.release();
    }
});

// 8) إرسال تقييم وتعليق على مزود خدمة بعد اكتمال الاتفاق
app.post('/api/service-requests/:id/rating', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const user_id = req.auth.uid; // 🔒 من التوكن

    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
        return res.status(400).json({ success: false, error: 'رقم طلب الخدمة غير صالح.' });
    }

    if (!user_id || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, error: 'بيانات التقييم غير صالحة.' });
    }

    // التعليق اختياري الآن
    const cleanComment = (typeof comment === 'string') ? comment.replace(/[<>]/g, '').trim().slice(0, 500) : '';
    const commentValue = cleanComment !== '' ? cleanComment : null;

    const client = await servicesPool.connect();
    try {
        await client.query('BEGIN');

        // التحقق من وجود الطلب وأنه مكتمل
        const reqResult = await client.query('SELECT * FROM public.service_requests WHERE id = $1', [id]);
        if (reqResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });
        }
        const request = reqResult.rows[0];

        if (request.status !== 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'يمكن التقييم فقط بعد اكتمال الاتفاق.' });
        }

        // التحقق من أن المستخدم هو الطالب (ليس المزود)
        if (Number(request.user_id) !== Number(user_id)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, error: 'يمكن للمستخدم الطالب فقط تقييم الخدمة.' });
        }

        // التحقق من عدم وجود تقييم سابق (لنفس الطلب، أو لنفس المعلم من نفس المستخدم عبر أي طلب سابق)
        const existingRating = await client.query(
            `SELECT id FROM public.service_ratings
             WHERE user_id = $2 AND (request_id = $1 OR (service_layer = $3 AND feature_id = $4))`,
            [id, user_id, request.service_layer, request.feature_id]
        );
        if (existingRating.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'لقد قمت بتقييم هذه الخدمة مسبقاً.' });
        }

        // إدراج التقييم (التعليق اختياري)
        await client.query(
            `INSERT INTO public.service_ratings (request_id, user_id, provider_user_id, service_layer, feature_id, rating, comment, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [id, user_id, request.provider_user_id, request.service_layer, request.feature_id, rating, commentValue]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'تم إرسال التقييم بنجاح.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ خطأ أثناء إرسال التقييم:', err.message);
        res.status(500).json({ success: false, error: 'فشل إرسال التقييم', details: IS_PROD ? undefined : err.message });
    } finally {
        client.release();
    }
});

// 9) جلب التقييمات لمزود خدمة معين (معروفاً بـ service_layer و feature_id)
app.get('/api/service-ratings', async (req, res) => {
    const { service_layer, feature_id } = req.query;

    if (!service_layer || !feature_id) {
        return res.status(400).json({ success: false, error: 'يجب تحديد service_layer و feature_id.' });
    }

    try {
        const result = await servicesPool.query(
            `SELECT sr.rating, sr.comment, sr.created_at, u.full_name as user_name
             FROM public.service_ratings sr
             LEFT JOIN public.users u ON sr.user_id = u.user_id
             WHERE sr.service_layer = $1 AND sr.feature_id = $2
             ORDER BY sr.created_at DESC`,
            [service_layer, feature_id]
        );

        // حساب المتوسط
        const ratings = result.rows;
        const averageRating = ratings.length > 0 
            ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
            : 0;

        res.json({
            success: true,
            ratings: ratings,
            averageRating: parseFloat(averageRating),
            totalRatings: ratings.length
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب التقييمات:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب التقييمات', details: IS_PROD ? undefined : err.message });
    }
});

        // =========================================================================
        // 🆕 9-ب) قائمة أفضل مزودي الخدمة تقييماً بناءً على تقييمات حقيقية فعلية
        // (جدول service_ratings الذي يُعبّأ فقط بعد اكتمال طلب خدمة حقيقي عبر نظام
        // الدردشة)، وليس بناءً على عمود rating الوهمي المخزّن يدوياً بجدول كل طبقة.
        // =========================================================================
        app.get('/api/top-rated-providers', async (req, res) => {
            try {
                const limit = Math.min(parseInt(req.query.limit, 10) || 15, 50);
                const result = await servicesPool.query(`
                    SELECT service_layer, feature_id,
                        ROUND(AVG(rating)::numeric, 1) AS avg_rating,
                        COUNT(*) AS total_ratings
                    FROM public.service_ratings
                    GROUP BY service_layer, feature_id
                    ORDER BY avg_rating DESC, total_ratings DESC
                    LIMIT $1
                `, [limit]);

                // طبقة أخفاها المشرف لا تظهر في القائمة العامة (والمسحوب يُسقطه search-features-batch عند جلب المعالم)
                const hidden = await getHiddenLayers();
                res.json({ success: true, items: result.rows.filter(row => !isLayerHidden(row.service_layer, hidden)) });
            } catch (err) {
                console.error('❌ خطأ أثناء جلب أفضل مزودي الخدمة تقييماً:', err.message);
                res.status(500).json({ success: false, error: 'فشل جلب البيانات', details: IS_PROD ? undefined : err.message });
            }
        });



// 9-ج) تقييمات نوع خدمة واحد مجمّعة لكل إعلان (عام): ما يرتّب مزودي النوع في بطاقة العقار (خدمات لهذه الأرض).
// متوسط وعدد فقط، لا تعليقات ولا أسماء. نوع أخفاه المشرف يرجع فارغاً.
app.get('/api/service-ratings-summary', async (req, res) => {
    const serviceLayer = String(req.query.service_layer || '').trim();
    if (!isValidLayer(serviceLayer)) {
        return res.status(400).json({ success: false, error: 'نوع خدمة غير صالح.' });
    }
    try {
        if (isLayerHidden(serviceLayer, await getHiddenLayers())) return res.json({ success: true, items: [] });
        const result = await servicesPool.query(
            `SELECT feature_id, ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*)::int AS total_ratings
             FROM public.service_ratings WHERE service_layer = $1 GROUP BY feature_id`,
            [serviceLayer]
        );
        res.json({ success: true, items: result.rows });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب ملخص التقييمات:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب البيانات', details: IS_PROD ? undefined : err.message });
    }
});

// 10) إضافة تعليق لاحقاً على تقييم موجود
app.put('/api/service-ratings/:id/comment', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    const user_id = req.auth.uid; // 🔒 من التوكن

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم مطلوب.' });
    }

    if (typeof comment !== 'string' || comment.trim() === '') {
        return res.status(400).json({ success: false, error: 'التعليق مطلوب.' });
    }

    const client = await servicesPool.connect();
    try {
        await client.query('BEGIN');

        // التحقق من وجود التقييم وأنه للمستخدم المحدد
        const ratingResult = await client.query(
            'SELECT * FROM public.service_ratings WHERE id = $1 AND user_id = $2',
            [id, user_id]
        );
        if (ratingResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'التقييم غير موجود أو لا تملك صلاحية تعديله.' });
        }

        const rating = ratingResult.rows[0];

        // التحقق من عدم وجود تعليق مسبقاً
        if (rating.comment) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'لقد قمت بإضافة تعليق مسبقاً.' });
        }

        // تحديث التعليق
        await client.query(
            'UPDATE public.service_ratings SET comment = $1 WHERE id = $2',
            [comment.replace(/[<>]/g, '').trim().slice(0, 500), id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'تم إضافة التعليق بنجاح.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ خطأ أثناء إضافة التعليق:', err.message);
        res.status(500).json({ success: false, error: 'فشل إضافة التعليق', details: IS_PROD ? undefined : err.message });
    } finally {
        client.release();
    }
});

// 11) التحقق من وجود تقييم سابق لمستخدم على طلب معين
app.get('/api/service-requests/:id/rating-check', requireAuth, async (req, res) => {
    const { id } = req.params;
    const user_id = req.auth.uid; // 🔒 من التوكن

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'يجب تحديد user_id.' });
    }

    try {
        // نفس قاعدة "تقييم واحد لكل نشاط": تقييم سابق لنفس المعلم يُحسب تقييماً لهذا الطلب أيضاً
        const result = await servicesPool.query(
            `SELECT r.id, r.comment FROM public.service_ratings r
             LEFT JOIN public.service_requests sr ON sr.id = $1
             WHERE r.user_id = $2
               AND (r.request_id = $1 OR (r.service_layer = sr.service_layer AND r.feature_id = sr.feature_id))
             ORDER BY (r.request_id = $1) DESC, r.id DESC
             LIMIT 1`,
            [id, user_id]
        );

        res.json({
            success: true,
            hasRated: result.rows.length > 0,
            hasComment: result.rows.length > 0 && result.rows[0].comment !== null,
            ratingId: result.rows.length > 0 ? result.rows[0].id : null
        });
    } catch (err) {
        console.error('❌ خطأ أثناء التحقق من التقييم:', err.message);
        res.status(500).json({ success: false, error: 'فشل التحقق من التقييم', details: IS_PROD ? undefined : err.message });
    }
});

// 12) جلب التقييمات التي تنقصها تعليق لمستخدم معين
app.get('/api/service-ratings/pending-comments', requireAuth, async (req, res) => {
    const user_id = req.auth.uid; // 🔒 من التوكن

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'يجب تحديد user_id.' });
    }

    try {
        const result = await servicesPool.query(
            `SELECT sr.id, sr.request_id, sr.service_layer, sr.feature_id, sr.rating, sr.created_at,
                    sr.provider_user_id, u.full_name as provider_name
             FROM public.service_ratings sr
             LEFT JOIN public.users u ON sr.provider_user_id = u.user_id
             WHERE sr.user_id = $1 AND (sr.comment IS NULL OR sr.comment = '')
             ORDER BY sr.created_at DESC`,
            [user_id]
        );

        res.json({
            success: true,
            pendingComments: result.rows
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب التقييمات التي تنقصها تعليق:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب التقييمات', details: IS_PROD ? undefined : err.message });
    }
});

// 13) جلب الطلبات المكتملة التي لم يتم تقييمها لمستخدم معين
app.get('/api/service-requests/pending-ratings', requireAuth, async (req, res) => {
    const user_id = req.auth.uid; // 🔒 من التوكن

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'يجب تحديد user_id.' });
    }

    try {
        const result = await servicesPool.query(
            `SELECT sr.id, sr.service_type, sr.provider_user_id, u.full_name as provider_name
             FROM public.service_requests sr
             LEFT JOIN public.users u ON sr.provider_user_id = u.user_id
             WHERE sr.user_id = $1 AND sr.status = 'completed'
             -- تقييم واحد لكل مستخدم لكل نشاط: طلب لنشاط قيّمه المستخدم سابقاً (بأي طلب) لا يُطلب تقييمه مجدداً
             AND NOT EXISTS (
                 SELECT 1 FROM public.service_ratings r
                 WHERE r.user_id = $1
                   AND (r.request_id = sr.id OR (r.service_layer = sr.service_layer AND r.feature_id = sr.feature_id))
             )
             ORDER BY sr.updated_at DESC`,
            [user_id]
        );

        res.json({
            success: true,
            pendingRatings: result.rows
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب الطلبات المكتملة التي لم يتم تقييمها:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب الطلبات', details: IS_PROD ? undefined : err.message });
    }
});

        // 7) إحصائية عدد عمليات النجاح لكل مزود خدمة
        app.get('/api/admin/provider-success-stats', requireAdmin, async (req, res) => {
            try {
                const result = await servicesPool.query(`
                    SELECT sr.id, sr.user_id, sr.provider_user_id, sr.service_layer, sr.feature_id,
                        sr.provider_name, sr.service_type, sr.status, sr.contact_type,
                        sr.cancellation_reason, sr.created_at, sr.updated_at,
                        ru.full_name AS username, ru.phone AS requester_phone, COALESCE(ru.phone, '') AS requester_whatsapp,
                        CASE WHEN sr.provider_user_id = sr.user_id THEN NULL ELSE pu.phone END AS provider_phone,
                        CASE WHEN sr.provider_user_id = sr.user_id THEN '' ELSE COALESCE(pu.phone, '') END AS provider_whatsapp
                    FROM public.service_requests sr
                    LEFT JOIN public.users ru ON ru.user_id = sr.user_id
                    LEFT JOIN public.users pu ON pu.user_id = sr.provider_user_id
                    ORDER BY sr.created_at DESC
                `);
                res.json({ success: true, stats: result.rows });
            } catch (err) {
                console.error('❌ خطأ حرج في الـ API:', err.message);
                res.status(500).json({ success: false, error: err.message });
            }
        });

// 🆕 7.5) تسجيل نقرات الاتصال والواتساب
app.post('/api/log-contact-click', requireAuth, async (req, res) => {
    const { service_layer, feature_id, provider_name, contact_type } = req.body;
    const user_id = req.auth.uid; // 🔒 من التوكن

    if (!user_id || !service_layer || !feature_id || !contact_type) {
        return res.status(400).json({ success: false, error: 'بيانات غير مكتملة.' });
    }
    if (!['call', 'whatsapp'].includes(contact_type)) {
        return res.status(400).json({ success: false, error: 'نوع التواصل غير صالح.' });
    }
    if (!isValidLayer(service_layer) || !Number.isInteger(Number(feature_id))) {
        return res.status(400).json({ success: false, error: 'قيمة غير صالحة.' });
    }

    try {
        // 🔒 نقرات متكررة على نفس الزر خلال 10 دقائق = سجل واحد (وإلا انتفخت الإحصائيات وتضاعفت فرص التقييم)
        const recent = await servicesPool.query(
            `SELECT id FROM public.service_requests
             WHERE user_id = $1 AND service_layer = $2 AND feature_id = $3 AND contact_type = $4
               AND created_at > NOW() - INTERVAL '10 minutes'
             ORDER BY id DESC LIMIT 1`,
            [user_id, service_layer, feature_id, contact_type]
        );
        if (recent.rows.length > 0) return res.json({ success: true, id: recent.rows[0].id });

        // محاولة العثور على مزود خدمة مرتبط
        const providerResult = await servicesPool.query(
            `SELECT user_id, full_name, phone
             FROM public.users
             WHERE role = 'provider' AND service_layer = $1 AND feature_id = $2 LIMIT 1`,
            [service_layer, feature_id]
        );

        let provider_user_id = null;
        // 🆕 [إصلاح]: نُعطي الأولوية دائماً للاسم الفعلي المُرسل من الواجهة
        // (وهو اسم مزود الخدمة الحقيقي كما أُدخل بحقل "name" بالمعلم على
        // الخريطة)، وليس اسم الطبقة. اسم الطبقة يبقى فقط كحل أخير جداً في
        // حال لم يصل أي اسم من الواجهة لأي سبب.
        // 🔒 تنظيف الاسم القادم من العميل (منع رموز HTML + تحديد الطول)
        const cleanProviderName = (provider_name === undefined || provider_name === null)
            ? '' : String(provider_name).replace(/[<>]/g, '').trim().slice(0, 100);
        let final_provider_name = cleanProviderName !== '' ? cleanProviderName : null;

        if (providerResult.rows.length > 0) {
            provider_user_id = providerResult.rows[0].user_id;
            // إذا لم تُرسل الواجهة اسماً صريحاً، نستخدم اسم صاحب الحساب الإداري كبديل
            if (!final_provider_name) {
                final_provider_name = providerResult.rows[0].full_name;
            }
        } else if (!final_provider_name) {
            // لا يوجد مزود مرتبط ولا اسم مُرسل من الواجهة: نستخدم اسم الطبقة كحل أخير فقط
            final_provider_name = service_layer;
        }

        // إذا لم يوجد مزود خدمة مرتبط، نستخدم user_id نفسه كـ provider_user_id مؤقتاً
        if (!provider_user_id) {
            provider_user_id = user_id;
        }

                const arabicServiceTypeForContact = LAYER_AR_NAMES[service_layer] || service_layer;

        const insertResult = await servicesPool.query(
            `INSERT INTO public.service_requests (user_id, provider_user_id, service_layer, feature_id, provider_name, service_type, contact_type, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed') RETURNING id, created_at`,
            [user_id, provider_user_id, service_layer, feature_id, final_provider_name, arabicServiceTypeForContact, contact_type]
        );

        res.json({ success: true, id: insertResult.rows[0].id });
    } catch (err) {
        console.error('❌ خطأ أثناء تسجيل النقرة:', err.message);
        res.status(500).json({ success: false, error: 'فشل تسجيل النقرة', details: IS_PROD ? undefined : err.message });
    }
});

// 7.1) حذف سجل طلب خدمة (للمشرف فقط)
app.delete('/api/admin/provider-success-stats/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        await servicesPool.query(
            'DELETE FROM public.service_requests WHERE id = $1',
            [id]
        );

        res.json({ success: true, message: 'تم حذف السجل بنجاح' });
    } catch (err) {
        console.error('❌ خطأ في حذف السجل:', err.message);
        res.status(500).json({ success: false, error: 'فشل حذف السجل' });
    }
});

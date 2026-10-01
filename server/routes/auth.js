// Accounts: register (optionally with a business), change password, verify session, login.
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ADMIN_JWT_SECRET, BCRYPT_SALT_ROUNDS, IS_PROD, app, authLimiter, clearLoginFailures, isLoginLocked, recordLoginFailure, verifyPasswordWithMigration } from '../app.js';
import { normalizeWhatsappNumber, servicesPool } from '../database.js';
import { authStatusCache, bearerToken, requireAuth, revokeToken, signSessionToken } from '../auth.js';
import { notifyUser } from '../state.js';
import { INSERT_SUBMISSION_SQL, parseListingInput, submissionParams } from '../listings.js';

// ==========================================
// 1️⃣ مسار تسجيل مستخدم جديد
// ==========================================
app.post('/api/auth/register', authLimiter, async (req, res) => {
    const { name, email = '', phone, password, whatsapp_number = '' } = req.body || {};
    const role = 'user'; // 🔒 الدور دائماً "مستخدم" ولا يُقبل من العميل (المشرف يرقّيه من لوحة الإدارة)
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const normalizedWhatsapp = whatsapp_number ? normalizeWhatsappNumber(whatsapp_number) : null;

    // 🔒 لا نطبع كلمة المرور بالـ log
    console.log("📥 محاولة تسجيل حساب جديد:", { phone: typeof phone === 'string' ? phone : null });

    // 🔒 فحص الأنواع (كان phone.trim() على قيمة غير نصية يترك الطلب معلّقاً بلا رد)
    const cleanName = (typeof name === 'string') ? name.replace(/[<>]/g, '').trim() : '';
    if (!cleanName || cleanName.length > 100 || typeof phone !== 'string' || !phone.trim() ||
        typeof password !== 'string' || !password || password.length > 128) {
        return res.status(400).json({ error: 'الرجاء تعبئة جميع الحقول المطلوبة بما فيها رقم الجوال' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.' });
    }
    if (whatsapp_number && !normalizedWhatsapp) {
        return res.status(400).json({ error: 'رقم واتساب غير صالح، يرجى إدخال رقم صحيح مع رمز الدولة.' });
    }

    const phoneRegex = /^05\d{8}$/;
    if (!phoneRegex.test(phone.trim())) {
        return res.status(400).json({ error: 'صيغة رقم الجوال غير صحيحة، يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.' });
    }

    // 🆕 صاحب نشاط يسجّل حسابه ونشاطه معاً: طلب واحد ينتظر موافقة واحدة (الموافقة تفعّل الحساب وتنشر النشاط)
    let listing = null;
    if (req.body.listing) {
        const parsedListing = parseListingInput(req.body.listing);
        if (parsedListing.error) return res.status(400).json({ error: parsedListing.error });
        listing = parsedListing.value;
    }

    try {
        if (normalizedEmail) {
            const checkEmailQuery = 'SELECT email FROM public.users WHERE email = $1';
            const emailCheckResult = await servicesPool.query(checkEmailQuery, [normalizedEmail]);

            if (emailCheckResult.rows.length > 0) {
                return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل!' });
            }
        }

        const checkPhoneQuery = 'SELECT phone FROM public.users WHERE phone = $1';
        const phoneCheckResult = await servicesPool.query(checkPhoneQuery, [phone.trim()]);

        if (phoneCheckResult.rows.length > 0) {
            return res.status(400).json({ error: 'رقم الجوال هذا مستخدم بالفعل من قبل حساب آخر!' });
        }

        // 🆕 [إصلاح ثغرة حرجة]: تشفير كلمة المرور بـ bcrypt قبل حفظها، بدل حفظها
        // كنص صريح بقاعدة البيانات (أي تسريب لقاعدة البيانات كان سيكشف كل
        // كلمات مرور المستخدمين فوراً وبدون أي جهد).
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        const insertUserQuery = `
            INSERT INTO public.users (full_name, email, phone, password_hash, role, status, is_active, whatsapp_number)
            VALUES ($1, $2, $3, $4, $5, 0, false, $6)
            RETURNING user_id, full_name, email, phone, role, whatsapp_number
        `;

        const client = await servicesPool.connect();
        let newUser;
        try {
            await client.query('BEGIN');
            const result = await client.query(insertUserQuery, [
                cleanName,
                normalizedEmail,
                phone.trim(),
                hashedPassword,
                role,
                normalizedWhatsapp
            ]);
            newUser = result.rows[0];
            if (listing) await client.query(INSERT_SUBMISSION_SQL, submissionParams(newUser.user_id, listing));
            await client.query('COMMIT');
        } catch (txErr) {
            await client.query('ROLLBACK').catch(() => {});
            throw txErr;
        } finally {
            client.release();
        }
        if (listing) {
            try {
                const admins = await servicesPool.query(`SELECT user_id FROM public.users WHERE role = 'admin' AND is_active = true`);
                await Promise.all(admins.rows.map(a => notifyUser(a.user_id, '📥 طلب إضافة نشاط جديد', `«${listing.name}» (حساب جديد) بانتظار المراجعة من صفحة طلبات الإضافة.`, 'info', '/admin/submissions')));
            } catch (notifyErr) {
                console.error('⚠️ تعذر إشعار المشرفين بالطلب الجديد:', notifyErr.message);
            }
        }

        console.log(`✅ تم إنشاء حساب جديد بنجاح برقم ID: ${newUser.user_id}`);

        res.status(201).json({
            status: 'success',
            message: 'تم التسجيل بنجاح في المنصة!',
            user: newUser
        });

    } catch (err) {
        console.error('❌ خطأ أثناء تسجيل المستخدم في قاعدة البيانات:', err.message);

        if (err.code === '23505') { // 🔒 تكرار رقم الجوال (فهرس UNIQUE)
            return res.status(400).json({ error: 'رقم الجوال هذا مستخدم بالفعل من قبل حساب آخر!' });
        }

        if (err.code === '28P01') {
            return res.status(401).json({
                error: 'فشل مصادقة قاعدة البيانات. تحقق من اسم المستخدم وكلمة المرور الخاصة بقاعدة PostgreSQL.',
                details: IS_PROD ? undefined : err.message
            });
        }

        if (err.code === '3D000' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            return res.status(502).json({
                error: 'تعذر الوصول إلى خادم PostgreSQL أو قاعدة البيانات غير موجودة.',
                details: IS_PROD ? undefined : err.message
            });
        }

        res.status(500).json({ 
            error: 'حدث خطأ داخلي بالسيرفر أثناء إنشاء الحساب',
            details: IS_PROD ? undefined : err.message 
        });
    }
}); 

// ==========================================
// 2️⃣ مسار تغيير كلمة المرور للمستخدم (التحقق من الحالية ثم كتابة الجديدة)
// ==========================================
app.post('/api/auth/change-password', authLimiter, requireAuth, async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    if (Number(userId) !== req.auth.uid) {
        return res.status(403).json({ error: 'لا يمكنك تغيير كلمة مرور حساب آخر.' });
    }

    console.log(`📥 محاولة تغيير كلمة المرور للمستخدم رقم: ${userId}`);

    // التأكد من إرسال كافة البيانات المطلوبة
    if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'الرجاء إدخال كلمة المرور الحالية وكلمة المرور الجديدة.' });
    }

    if (newPassword.trim().length < 6) {
        return res.status(400).json({ error: 'يجب أن تتكون كلمة المرور الجديدة من 6 خانات على الأقل.' });
    }

    try {
        // 1. جلب كلمة المرور الحالية المخزنة في قاعدة البيانات لهذا المستخدم
        const getUserQuery = 'SELECT password_hash FROM public.users WHERE user_id = $1';
        const userResult = await servicesPool.query(getUserQuery, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'المستخدم غير موجود في النظام!' });
        }

        const storedPassword = userResult.rows[0].password_hash;

        // 2. مقارنة كلمة المرور المدخلة بالحالية - يدعم الحسابات المشفرة
        //    بـ bcrypt والحسابات القديمة (نصية) على حد سواء
        const { valid } = await verifyPasswordWithMigration(currentPassword, storedPassword);
        if (!valid) {
            return res.status(400).json({ error: 'كلمة المرور الحالية التي أدخلتها غير صحيحة!' });
        }

        // 3. تحديث كلمة المرور الجديدة في قاعدة البيانات (مشفّرة دائماً بـ bcrypt)
        const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
        const updatePasswordQuery = `
            UPDATE public.users 
            SET password_hash = $1, token_version = token_version + 1
            WHERE user_id = $2
            RETURNING token_version, role
        `;
        const pwUpdate = await servicesPool.query(updatePasswordQuery, [hashedNewPassword, userId]);
        authStatusCache.delete(Number(userId));
        // 🔒 الجلسات الأخرى تنتهي، وهذه الجلسة تستلم توكناً جديداً تلقائياً (auth-fetch.js يحفظ X-New-Token)
        if (pwUpdate.rows[0]) {
            const pwRole = pwUpdate.rows[0].role;
            res.setHeader('X-New-Token', signSessionToken(userId, pwRole, pwUpdate.rows[0].token_version));
        }

        console.log(`✅ تم تحديث كلمة المرور بنجاح للمستخدم رقم: ${userId}`);

        res.status(200).json({
            status: 'success',
            message: 'تم تغيير كلمة المرور بنجاح!'
        });

    } catch (err) {
        console.error('❌ خطأ أثناء تغيير كلمة المرور في قاعدة البيانات:', err.message);
        res.status(500).json({ 
            error: 'حدث خطأ داخلي بالسيرفر أثناء تعديل كلمة المرور',
            details: IS_PROD ? undefined : err.message 
        });
    }
}); 

// =========================================================================
// 🆕 مسار التحقق من صلاحية الجلسة المحفوظة محلياً (يُستدعى عند كل دخول
// تلقائي autoboot في auth-app-events.js قبل السماح بالدخول للمنصة). يمنع
// دخول أي مستخدم تم تسجيل خروجه إجبارياً أو تعطيل حسابه من قبل الإدارة،
// حتى لو كان غير متصل بالإنترنت وقت تنفيذ الإجراء من لوحة التحكم.
// =========================================================================
app.post('/api/auth/verify-session', async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ valid: false, reason: 'missing_user_id' });
    }

    try {
        const result = await servicesPool.query(
            'SELECT is_active, force_logout_flag FROM public.users WHERE user_id = $1',
            [user_id]
        );

        if (result.rows.length === 0) {
            return res.json({ valid: false, reason: 'not_found' });
        }

        const { is_active, force_logout_flag } = result.rows[0];

        if (!is_active) {
            return res.json({ valid: false, reason: 'inactive' });
        }

        if (force_logout_flag === true) {
            return res.json({ valid: false, reason: 'force_logout' });
        }

        return res.json({ valid: true });
    } catch (err) {
        console.error('❌ خطأ أثناء التحقق من صلاحية الجلسة:', err.message);
        // Fail-open عند خطأ سيرفر مؤقت (شبكة/قاعدة بيانات) حتى لا نمنع مستخدمين
        // شرعيين من الدخول بسبب عطل عابر لا علاقة له بصلاحية الجلسة فعلياً
        return res.json({ valid: true, error: true });
    }
});

// مسار تسجيل الدخول المحدث (الفحص الثلاثي المتطابق الشامل بدون أي قيم وهمية)
app.post('/api/auth/login', authLimiter, async (req, res) => {
    const requestBody = req.body || {};
    const { email = '', phone, password } = requestBody;
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const normalizedPhone = phone ? String(phone).trim() : '';

    if (!normalizedPhone || !password || typeof password !== 'string') {
        console.warn('[LOGIN] missing fields', { email: normalizedEmail, phone: normalizedPhone, hasPassword: !!password });
        return res.status(400).json({ message: 'الرجاء إدخال رقم الجوال وكلمة المرور.' });
    }

    try {
        if (isLoginLocked(normalizedPhone, req.ip)) {
            return res.status(429).json({ message: 'تم إيقاف تسجيل الدخول مؤقتاً لكثرة المحاولات الخاطئة. حاول بعد 15 دقيقة.' });
        }

        let userQuery = 'SELECT * FROM public.users WHERE phone = $1';
        let queryParams = [normalizedPhone];

        if (normalizedEmail) {
            userQuery = 'SELECT * FROM public.users WHERE email = $1 AND phone = $2';
            queryParams = [normalizedEmail, normalizedPhone];
        }

        console.log('[LOGIN] query params', { email: normalizedEmail, phone: normalizedPhone });
        const result = await servicesPool.query(userQuery, queryParams);

        if (result.rows.length === 0) {
            recordLoginFailure(normalizedPhone, req.ip);
            return res.status(401).json({ message: 'رقم الجوال أو كلمة المرور غير صحيحة.' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ message: 'خطأ في الدخول: هذا الحساب معطل حالياً، يرجى التواصل معنا عبر صفحة الفيس بوك لإصلاح الخطأ.' });
        }

        // 🆕 [إصلاح ثغرة حرجة]: التحقق من كلمة المرور يدعم الآن bcrypt، مع
        // ترحيل شفاف للحسابات القديمة (كانت مخزَّنة كنص صريح) إلى bcrypt فور
        // أول تسجيل دخول ناجح لها، بدل مقارنة نصية مباشرة كما كان سابقاً.
        const { valid: passwordValid, needsRehash } = await verifyPasswordWithMigration(password, user.password_hash);
        if (!passwordValid) {
            recordLoginFailure(normalizedPhone, req.ip);
            return res.status(401).json({ message: 'رقم الجوال أو كلمة المرور غير صحيحة.' });
        }
        clearLoginFailures(normalizedPhone, req.ip);

        if (needsRehash) {
            const migratedHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
            await servicesPool.query('UPDATE public.users SET password_hash = $1 WHERE user_id = $2', [migratedHash, user.user_id]);
            console.log(`🔐 تم ترحيل كلمة مرور المستخدم ${user.user_id} من نص صريح إلى bcrypt.`);
        }

        // 🆕 إعادة تفعيل الحساب: تسجيل الدخول الناجح يلغي أي علامة "تسجيل خروج
        // إجباري" سابقة كانت مفعّلة من قبل الإدارة، حتى يستطيع المستخدم
        // استخدام المنصة بشكل طبيعي بعد إعادة الدخول الصريحة ببياناته.
        await servicesPool.query('UPDATE public.users SET force_logout_flag = false WHERE user_id = $1', [user.user_id]);

                // 🛑 [إصلاح حاسم للأمان وجذر المشكلة]: إرجاع القيمة الفعلية من الداتابيز فقط (null إذا لم يكن مربوطاً)
        // تم إلغاء فرض طبقة النجار carpenter والمعلم 14 للحسابات غير المربوطة بشكل كامل هنا.
        const finalLayer = user.service_layer ? user.service_layer.trim() : null;
        const finalId = user.feature_id ? user.feature_id : null;

        // 🆕 إصدار توكن موقّع للمشرفين فقط، يحل محل الثقة بأي رقم يرسله المتصفح
        let adminToken = null;
        if (user.role === 'admin') {
            adminToken = signSessionToken(user.user_id, 'admin', user.token_version);
        }

        // 🔒 توكن الجلسة لجميع الأدوار (عمره SESSION_TTL_DAYS ويتجدد مع الاستخدام)؛ الإبطال عبر token_version
        const sessionToken = adminToken || signSessionToken(user.user_id, user.role, user.token_version);

        res.status(200).json({
            message: 'تم تسجيل الدخول بنجاح بالمطابقة الكاملة الثلاثية المشروطة ببيانات قاعدة البيانات الحقيقية',
            user: {
                user_id: user.user_id,
                id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                whatsapp_number: user.whatsapp_number || null,
                role: user.role,
                status: user.status !== null ? parseInt(user.status) : 0,
                target_layer: finalLayer,
                targetId: finalId,
                target_id: finalId,
                x_coord: user.x_coord,
                y_coord: user.y_coord,
                admin_token: adminToken,
                token: sessionToken
            }
        });

    } catch (error) {
        console.error('Database Login Error:', error);
        console.error('[LOGIN] phone:', normalizedPhone);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء عملية تسجيل الدخول الثلاثية المشروطة.' });
    }
});

// 🔒 تسجيل الخروج: يُنهي توكن هذا الجهاز على السيرفر (لا يكفي حذفه من المتصفح: نسخة منه تبقى صالحة حتى انتهائها).
// لا يحتاج حساباً فعّالاً، وتوكن غير صالح أصلاً لا شيء فيه لإنهائه.
app.post('/api/auth/logout', async (req, res) => {
    const token = bearerToken(req);
    if (!token) return res.json({ success: true });
    let decoded;
    try {
        decoded = jwt.verify(token, ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
        return res.json({ success: true });
    }
    try {
        await revokeToken(token, decoded.exp);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ تعذر إنهاء الجلسة:', err.message);
        res.status(500).json({ success: false, error: 'تعذر تسجيل الخروج من السيرفر.' });
    }
});

// Admin: users, online users, forced logout, editing a user.
import bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS, IS_PROD, app } from '../app.js';
import { servicesPool } from '../database.js';
import { authStatusCache, requireAdmin } from '../auth.js';
import { clearProviderLinkedCache, connectedUsers } from '../state.js';

// 1. جلب جميع المستخدمين مع خيارات البحث والتصفية
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const { search, status_filter, role_filter } = req.query;
        
        let query = `
            SELECT 
                user_id, 
                full_name, 
                email, 
                phone, 
                role, 
                is_active, 
                status, 
                service_layer, 
                feature_id,
                x_coord,
                y_coord,
                created_at,
                request_limit,
                request_limit_period
            FROM public.users
        `;
        
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        // إضافة شرط البحث النصي (الاسم أو البريد أو رقم الجوال)
        if (search && search.trim() !== '') {
            conditions.push(`(
                full_name ILIKE $${paramIndex} OR 
                email ILIKE $${paramIndex} OR 
                phone ILIKE $${paramIndex}
            )`);
            params.push(`%${search.trim()}%`);
            paramIndex++;
        }

        // إضافة شرط حالة الاتصال (متصل/غير متصل)
        if (status_filter === 'online') {
            const onlineUserIds = Array.from(connectedUsers.keys());
            if (onlineUserIds.length > 0) {
                conditions.push(`user_id = ANY($${paramIndex})`);
                params.push(onlineUserIds);
                paramIndex++;
            } else {
                // إذا لم يكن هناك متصلين، نرجع قائمة فارغة
                return res.json({
                    success: true,
                    users: [],
                    onlineUserIds: [],
                    total: 0
                });
            }
        } else if (status_filter === 'offline') {
            const onlineUserIds = Array.from(connectedUsers.keys());
            if (onlineUserIds.length > 0) {
                conditions.push(`user_id != ALL($${paramIndex})`);
                params.push(onlineUserIds);
                paramIndex++;
            }
        }

        // إضافة شرط نوع المستخدم (دور المستخدم)
        if (role_filter && role_filter !== 'all') {
            conditions.push(`role = $${paramIndex}`);
            params.push(role_filter);
            paramIndex++;
        }

        // إضافة الشروط إلى الاستعلام
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY user_id ASC';

        const result = await servicesPool.query(query, params);

        // إضافة حالة الاتصال لكل مستخدم
        const onlineUserIds = Array.from(connectedUsers.keys()).map(id => String(id));
        const usersWithStatus = result.rows.map(user => ({
            ...user,
            is_online: onlineUserIds.includes(String(user.user_id))
        }));

        res.json({
            success: true,
            users: usersWithStatus,
            onlineUserIds: onlineUserIds,
            total: usersWithStatus.length
        });
    } catch (error) {
        console.error('❌ خطأ في جلب المستخدمين:', error.message);
        res.status(500).json({ success: false, error: 'فشل جلب المستخدمين', details: IS_PROD ? undefined : error.message });
    }
});

// 1-أ. جلب قائمة معرّفات المستخدمين المتصلين حالياً فقط (لتحديث سريع دوري بدون إعادة جلب كل الجدول)
app.get('/api/admin/online-users', requireAdmin, (req, res) => {
    try {
        const onlineUserIds = Array.from(connectedUsers.keys()).map(id => String(id));
        res.json({ success: true, onlineUserIds });
    } catch (error) {
        console.error('❌ خطأ في جلب حالة الاتصال:', error.message);
        res.status(500).json({ success: false, error: 'فشل جلب حالة الاتصال', details: IS_PROD ? undefined : error.message });
    }
});

// 1-ب. تسجيل خروج فوري لمستخدم محدد من قبل المشرف + إشعاره فوراً
app.post('/api/admin/users/force-logout', requireAdmin, async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم مطلوب' });
    }

    try {
        const checkUser = await servicesPool.query('SELECT user_id, full_name FROM public.users WHERE user_id = $1', [user_id]);
        if (checkUser.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }

        const title = '🚨 تسجيل خروج إجباري من الإدارة';
        const message = 'تم تسجيل خروجك فوراً من قبل الإدارة. يرجى التواصل مع الإدارة حالاً لحل مشكلة الحظر قبل محاولة الدخول مجدداً.';

        // 🆕 [إصلاح الثغرة]: تفعيل علامة إبطال الجلسة فعلياً في قاعدة البيانات.
        // هذا يضمن أن المستخدم لن يستطيع الدخول تلقائياً بجلسته المحفوظة محلياً
        // حتى لو كان غير متصل الآن، لأن /api/auth/verify-session سيرفض جلسته
        // في المرة القادمة التي يفتح فيها الصفحة.
        await servicesPool.query('UPDATE public.users SET force_logout_flag = true, token_version = token_version + 1 WHERE user_id = $1', [user_id]);
        authStatusCache.delete(Number(user_id)); // 🔒 يسري إبطال الجلسة فوراً

        // حفظ الإشعار بقاعدة البيانات (يظهر له لاحقاً حتى لو كان غير متصل الآن)
        await servicesPool.query(
            `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
             VALUES ($1, $2, $3, 'error', false, NOW())`,
            [user_id, title, message]
        );

        // إخراجه فوراً إن كان متصلاً حالياً عبر Socket.io
        const targetSocketId = connectedUsers.get(user_id) || connectedUsers.get(String(user_id)) || connectedUsers.get(Number(user_id));
        let wasOnline = false;
        if (targetSocketId && global.io) {
            global.io.to(targetSocketId).emit('force_relogin', { message });
            wasOnline = true;
            console.log(`🚨 تم تسجيل خروج إجباري فوري للمستخدم ${user_id}`);
        } else {
            console.log(`💤 المستخدم ${user_id} غير متصل حالياً، سيصله الإشعار عند دخوله القادم وسيُمنع دخوله التلقائي فوراً`);
        }

        res.json({
            success: true,
            message: wasOnline
                ? 'تم تسجيل خروج المستخدم فوراً وإرسال التنبيه بنجاح'
                : 'المستخدم غير متصل حالياً، لكن تم إبطال جلسته فعلياً وسيُمنع من الدخول التلقائي في المرة القادمة',
            wasOnline
        });
    } catch (error) {
        console.error('❌ خطأ في تسجيل الخروج الإجباري:', error.message);
        res.status(500).json({ success: false, error: 'فشل تنفيذ تسجيل الخروج الإجباري', details: IS_PROD ? undefined : error.message });
    }
});

// 1-ج. تسجيل خروج جماعي لجميع المستخدمين (متصلين وغير متصلين)
app.post('/api/admin/users/force-logout-all', requireAdmin, async (req, res) => {
    const { target_type, user_ids } = req.body; // target_type: 'all', 'online', 'offline', 'selected'

    try {
        let targetUsers = [];
        let title = '🚨 تسجيل خروج جماعي من الإدارة';
        let message = 'تم تسجيل خروجك من قبل الإدارة. يرجى إعادة تسجيل الدخول للمتابعة.';

        // تحديد المستخدمين المستهدفين حسب نوع الاستهداف
        switch (target_type) {
            case 'all':
                // جميع المستخدمين
                const allUsersQuery = `SELECT user_id FROM public.users`;
                const allUsersResult = await servicesPool.query(allUsersQuery);
                targetUsers = allUsersResult.rows.map(row => row.user_id);
                message = 'تم تسجيل خروج جميع المستخدمين من قبل الإدارة. يرجى إعادة تسجيل الدخول للمتابعة.';
                break;

            case 'online':
                // المستخدمين المتصلين حالياً فقط
                targetUsers = Array.from(connectedUsers.keys()).map(id => Number(id));
                message = 'تم تسجيل خروج جميع المستخدمين المتصلين حالياً من قبل الإدارة.';
                break;

            case 'offline':
                // المستخدمين غير المتصلين
                const onlineUserIds = Array.from(connectedUsers.keys()).map(id => Number(id));
                const offlineUsersQuery = `SELECT user_id FROM public.users WHERE user_id != ALL($1)`;
                const offlineUsersResult = await servicesPool.query(offlineUsersQuery, [onlineUserIds.length > 0 ? onlineUserIds : [0]]);
                targetUsers = offlineUsersResult.rows.map(row => row.user_id);
                message = 'تم تسجيل خروج جميع المستخدمين غير المتصلين من قبل الإدارة.';
                break;

            case 'selected':
                // مستخدمين محددين
                if (!user_ids || user_ids.length === 0) {
                    return res.status(400).json({ success: false, error: 'يجب اختيار مستخدم واحد على الأقل' });
                }
                targetUsers = user_ids.map(id => Number(id));
                message = 'تم تسجيل خروجك من قبل الإدارة. يرجى إعادة تسجيل الدخول للمتابعة.';
                break;

            default:
                return res.status(400).json({ success: false, error: 'نوع استهداف غير صالح' });
        }

        if (targetUsers.length === 0) {
            return res.status(400).json({ success: false, error: 'لا يوجد مستخدمين مستهدفين' });
        }

        // 🆕 [إصلاح الثغرة]: تفعيل علامة إبطال الجلسة دفعة واحدة لكل المستخدمين
        // المستهدفين، بغض النظر عن كونهم متصلين الآن أم لا. هذا يمنعهم من
        // الدخول التلقائي بجلسة محفوظة قديمة عبر /api/auth/verify-session.
        await servicesPool.query('UPDATE public.users SET force_logout_flag = true, token_version = token_version + 1 WHERE user_id = ANY($1)', [targetUsers]);
        authStatusCache.clear(); // 🔒 يسري إبطال الجلسات فوراً

        let onlineCount = 0;
        let offlineCount = 0;

        // إرسال الإشعارات وتسجيل الخروج لكل مستخدم
        for (const userId of targetUsers) {
            try {
                // حفظ الإشعار في قاعدة البيانات
                await servicesPool.query(
                    `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
                     VALUES ($1, $2, $3, 'error', false, NOW())`,
                    [userId, title, message]
                );

                // إخراجه فوراً إن كان متصلاً حالياً عبر Socket.io
                const targetSocketId = connectedUsers.get(userId) || connectedUsers.get(String(userId)) || connectedUsers.get(Number(userId));
                if (targetSocketId && global.io) {
                    global.io.to(targetSocketId).emit('force_relogin', { message });
                    onlineCount++;
                    console.log(`🚨 تم تسجيل خروج فوري للمستخدم ${userId}`);
                } else {
                    offlineCount++;
                    console.log(`💤 المستخدم ${userId} غير متصل، تم حفظ الإشعار وإبطال جلسته المحفوظة`);
                }
            } catch (err) {
                console.error(`❌ خطأ في تسجيل خروج المستخدم ${userId}:`, err.message);
            }
        }

        res.json({
            success: true,
            message: `تم تسجيل خروج ${targetUsers.length} مستخدم (${onlineCount} متصل، ${offlineCount} غير متصل) وإبطال جلساتهم فعلياً`,
            total: targetUsers.length,
            online: onlineCount,
            offline: offlineCount
        });
    } catch (error) {
        console.error('❌ خطأ في تسجيل الخروج الجماعي:', error.message);
        res.status(500).json({ success: false, error: 'فشل تنفيذ تسجيل الخروج الجماعي', details: IS_PROD ? undefined : error.message });
    }
});

// 2. تحديث بيانات مستخدم (تفعيل، تغيير الدور، ربط مزود خدمة، تغيير كلمة المرور)
app.post('/api/admin/users/update', requireAdmin, async (req, res) => {
    const { user_id, role, is_active, service_layer, feature_id, new_password, request_limit, request_limit_period } = req.body;

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم (user_id) مطلوب' });
    }

    try {
        // التحقق من وجود المستخدم
        const checkUser = await servicesPool.query('SELECT user_id, role, is_active FROM public.users WHERE user_id = $1', [user_id]);
        if (checkUser.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }

        const currentUser = checkUser.rows[0];
        const updateFields = [];
        const updateValues = [];
        let idx = 1;

        // تحديث role (نوع الحساب)
        if (role !== undefined) {
            const validRoles = ['user', 'provider', 'admin'];
            const normalizedRole = String(role).toLowerCase().trim();
            if (validRoles.includes(normalizedRole)) {
                updateFields.push(`role = $${idx++}`);
                updateValues.push(normalizedRole);
            }
        }

        // تحديث is_active (تفعيل/تعطيل الحساب)
        if (is_active !== undefined) {
            updateFields.push(`is_active = $${idx++}`);
            updateValues.push(is_active === true);
        }

        // تحديث service_layer (ربط مزود خدمة)
        if (service_layer !== undefined) {
            updateFields.push(`service_layer = $${idx++}`);
            updateValues.push(service_layer && service_layer.trim() !== '' ? service_layer.trim() : null);
        }

        // تحديث feature_id
        if (feature_id !== undefined) {
            updateFields.push(`feature_id = $${idx++}`);
            updateValues.push(feature_id ? parseInt(feature_id) : null);
        }

        // تحديث كلمة المرور (مشفّرة دائماً بـ bcrypt، وليس كنص صريح)
        if (new_password && new_password.trim().length >= 6) {
            const hashedAdminSetPassword = await bcrypt.hash(new_password.trim(), BCRYPT_SALT_ROUNDS);
            updateFields.push(`password_hash = $${idx++}`);
            updateValues.push(hashedAdminSetPassword);
        }

        // تحديث حد الطلبات/الأحداث (اتركه فارغاً = مفتوح بدون حد - وهو الوضع الافتراضي)
        if (request_limit !== undefined) {
            const parsedLimit = (request_limit === null || request_limit === '') ? null : parseInt(request_limit, 10);
            updateFields.push(`request_limit = $${idx++}`);
            updateValues.push((parsedLimit && parsedLimit > 0) ? parsedLimit : null);
        }

        // تحديث نوع فترة حد الطلبات (يومي / أسبوعي / شهري)
        if (request_limit_period !== undefined) {
            const validPeriods = ['daily', 'weekly', 'monthly'];
            const normalizedPeriod = validPeriods.includes(request_limit_period) ? request_limit_period : 'daily';
            updateFields.push(`request_limit_period = $${idx++}`);
            updateValues.push(normalizedPeriod);
        }

        // 🔒 تغيير الدور أو التفعيل أو كلمة المرور يُبطل توكنات المستخدم القديمة فوراً (إلا إذا كان المشرف يعدّل حسابه هو)
        const roleChanged = role !== undefined && String(role).toLowerCase().trim() !== currentUser.role;
        const activeChanged = is_active !== undefined && (is_active === true) !== !!currentUser.is_active;
        const passwordChanged = !!(new_password && new_password.trim().length >= 6);
        // تغيير الدور أو التفعيل أو كلمة المرور فقط يُنهي الجلسة؛ تعديل حد الطلبات أو ربط الخدمة لا يحتاج إعادة دخول
        const sessionEnded = (roleChanged || activeChanged || passwordChanged) && Number(user_id) !== Number(req.adminUserId);
        if (sessionEnded) {
            updateFields.push('token_version = token_version + 1');
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: 'لا توجد تغييرات للحفظ' });
        }

        // بناء وتنفيذ الاستعلام النهائي
        const finalQuery = `UPDATE public.users SET ${updateFields.join(', ')} WHERE user_id = $${idx}`;
        updateValues.push(user_id);

        await servicesPool.query(finalQuery, updateValues);
        authStatusCache.delete(Number(user_id)); // 🔒 يسري تغيير الدور/التفعيل فوراً
        clearProviderLinkedCache(); // ربط مزود الخدمة قد تغيّر

        console.log(`✅ تم تحديث المستخدم ${user_id} بنجاح`);

        // 🔔 إشعار + أمر إعادة الدخول فقط عندما انتهت جلسته فعلاً (كان يُرسل مع أي تعديل، فيُخرج المستخدم من كل أجهزته
        // لمجرد تغيير حد طلباته مثلاً)
        if (sessionEnded) try {
            // حفظ إشعار في قاعدة البيانات
            const notifQuery = `
                INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
                VALUES ($1, $2, $3, 'warning', false, NOW())
            `;
            await servicesPool.query(notifQuery, [
                user_id,
                '⚠️ تم تحديث حسابك من قبل الإدارة',
                'تم تعديل بيانات حسابك (الصلاحيات/الحالة). يرجى تسجيل الخروج ثم إعادة تسجيل الدخول لتطبيق التغييرات.'
            ]);

            // إرسال أمر force_relogin عبر Socket.io إذا كان المستخدم متصلاً
            const targetSocketId = connectedUsers.get(user_id);
            if (targetSocketId && global.io) {
                global.io.to(targetSocketId).emit('force_relogin', {
                    message: 'تم تحديث حسابك من قبل الإدارة. يرجى تسجيل الخروج ثم إعادة تسجيل الدخول لتطبيق التغييرات.'
                });
                console.log(`📡 تم إرسال أمر force_relogin للمستخدم ${user_id}`);
            } else {
                console.log(`💤 المستخدم ${user_id} غير متصل حالياً، تم حفظ الإشعار فقط`);
            }
        } catch (notifErr) {
            console.error(`⚠️ فشل إرسال إشعار التحديث للمستخدم ${user_id}:`, notifErr.message);
        }

        res.json({
            success: true,
            message: 'تم تحديث بيانات المستخدم بنجاح'
        });

    } catch (error) {
        console.error('❌ خطأ في تحديث المستخدم:', error.message);
        res.status(500).json({ success: false, error: 'فشل تحديث بيانات المستخدم', details: IS_PROD ? undefined : error.message });
    }
});

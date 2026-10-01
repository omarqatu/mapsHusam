// socket.io: who is online, live requests and chat, notifications.
import jwt from 'jsonwebtoken';
import { ADMIN_JWT_SECRET, io } from './app.js';
import { servicesPool } from './database.js';
import { getAuthStatus, isActiveAdmin, isTokenRevoked, tokenKey } from './auth.js';
import { connectedUsers, userRoom } from './state.js';

// ==========================================
// Socket.io - نظام الإشعارات في الوقت الفعلي
// ==========================================


// 🔒 لا يُقبل اتصال Socket بدون توكن صالح
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth && socket.handshake.auth.token;
        if (!token || isTokenRevoked(token)) return next(new Error('unauthorized'));
        // التوكن يحمل exp ويتجدد مع الاستخدام (signSessionToken)، فلا حاجة لـ ignoreExpiration هنا أيضاً
        const decoded = jwt.verify(token, ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
        const uid = Number(decoded.uid);
        if (!Number.isInteger(uid) || uid <= 0) return next(new Error('unauthorized'));
        // 🔒 الحالة والدور ورقم النسخة من قاعدة البيانات (وليس من التوكن وحده)
        const status = await getAuthStatus(uid);
        if (!status.exists || !status.active || (Number(decoded.tv) || 0) !== status.tokenVersion) {
            return next(new Error('unauthorized'));
        }
        socket.auth = { uid, role: status.role };
        socket.data.tokenKey = tokenKey(token); // لقطع الاتصال عند تسجيل الخروج (revokeToken)
        next();
    } catch (e) {
        next(new Error('unauthorized'));
    }
});

io.on('connection', (socket) => {
    console.log(`🔗 مستخدم جديد متصل: ${socket.id}`);

    // 🔒 حد أحداث لكل اتصال (حماية من الإغراق): SOCKET_RATE_LIMIT حدثاً بالثانية
    const socketRate = { count: 0, resetAt: Date.now() + 1000 };
    const SOCKET_EVENTS_PER_SECOND = Number(process.env.SOCKET_RATE_LIMIT || 20);
    socket.use((packet, next) => {
        const now = Date.now();
        if (now > socketRate.resetAt) { socketRate.count = 0; socketRate.resetAt = now + 1000; }
        if (++socketRate.count > SOCKET_EVENTS_PER_SECOND) return; // الحزمة الزائدة تُتجاهل بصمت
        next();
    });

    // عند تسجيل دخول المستخدم، نقوم بربط Socket ID بمعرف المستخدم
    socket.on('user_connected', () => {
        const userId = socket.auth.uid; // 🔒 الهوية من التوكن وليس مما يرسله العميل
        console.log(`👤 المستخدم ${userId} متصل بـ Socket ID: ${socket.id}`);
        // 🆕 غرفة لكل مستخدم تضم كل أجهزته وتبويباته: كل io.to(...) للمستخدم يصلها جميعاً. كانت الخريطة تحفظ آخر
        // اتصال فقط، فمستخدم على جهازين (أو تبويبين) لا تصله الأحداث الحية (قبول الطلب، الرسائل...) إلا على آخرهما.
        const room = userRoom(userId);
        socket.join(room);
        connectedUsers.set(userId, room);
        socket.userId = userId;

        // إرسال تأكيد الاتصال للمستخدم
        socket.emit('connection_confirmed', { userId, socketId: socket.id });
    });

    // عند فصل المستخدم
    socket.on('disconnect', () => {
        if (socket.userId) {
            console.log(`🔌 المستخدم ${socket.userId} انقطع اتصاله`);
            // يبقى المستخدم «متصلاً» ما دام له اتصال آخر بغرفته (جهاز أو تبويب آخر)
            const remaining = io.sockets.adapter.rooms.get(userRoom(socket.userId));
            if (!remaining || remaining.size === 0) {
                connectedUsers.delete(socket.userId);
            }
        }
    });

    // استقبال إشعار من لوحة التحكم وإرساله للمستخدم المستهدف
    socket.on('send_notification', async (data) => {
        console.log('📨 استلام طلب إرسال إشعار:', data);

        // 🔒 الإرسال للمشرفين فقط (مع التحقق من الدور الحالي بقاعدة البيانات)
        if (!socket.auth || socket.auth.role !== 'admin' || !(await isActiveAdmin(socket.auth.uid))) {
            socket.emit('notification_error', { error: 'غير مصرح لك بإرسال الإشعارات' });
            return;
        }

        const { targetType, targetUserId, targetUserIds, title, message, type } = data || {};

        if (!title || !message) {
            console.error('❌ بيانات الإشعار غير مكتملة:', { title, message });
            socket.emit('notification_error', { error: 'بيانات الإشعار غير مكتملة' });
            return;
        }

        try {
            let targetUsers = [];
            let sentCount = 0;

            console.log(`🎯 نوع الاستهداف: ${targetType}`);

            // تحديد المستخدمين المستهدفين حسب نوع الاستهداف
            switch (targetType) {
                case 'single':
                    if (!targetUserId) {
                        console.error('❌ معرف المستخدم مطلوب');
                        socket.emit('notification_error', { error: 'معرف المستخدم مطلوب' });
                        return;
                    }
                    targetUsers = [targetUserId];
                    console.log(`👤 مستخدم واحد: ${targetUserId}`);
                    break;

                case 'online':
                    // إرسال للمستخدمين المتصلين حالياً
                    targetUsers = Array.from(connectedUsers.keys());
                    console.log(`📡 إرسال للمتصلين حالياً: ${targetUsers.length} مستخدم`, targetUsers);
                    break;

                case 'all_users':
                    // إرسال لجميع المستخدمين في قاعدة البيانات
                    console.log('🔍 جلب جميع المستخدمين من قاعدة البيانات...');
                    try {
                        const allUsersQuery = `SELECT user_id FROM public.users`;
                        const allUsersResult = await servicesPool.query(allUsersQuery);
                        targetUsers = allUsersResult.rows.map(row => row.user_id);
                        console.log(`📡 إرسال لجميع المستخدمين: ${targetUsers.length} مستخدم`, targetUsers);
                    } catch (dbErr) {
                        console.error('❌ خطأ في جلب المستخدمين:', dbErr);
                        socket.emit('notification_error', { error: 'فشل جلب المستخدمين من قاعدة البيانات' });
                        return;
                    }
                    break;

                case 'regular_users':
                    // إرسال للمستخدمين العاديين فقط
                    console.log('🔍 جلب المستخدمين العاديين...');
                    try {
                        const regularUsersQuery = `SELECT user_id FROM public.users WHERE role = 'user' OR role IS NULL`;
                        const regularUsersResult = await servicesPool.query(regularUsersQuery);
                        targetUsers = regularUsersResult.rows.map(row => row.user_id);
                        console.log(`📡 إرسال للمستخدمين العاديين: ${targetUsers.length} مستخدم`, targetUsers);
                    } catch (dbErr) {
                        console.error('❌ خطأ في جلب المستخدمين العاديين:', dbErr);
                        socket.emit('notification_error', { error: 'فشل جلب المستخدمين العاديين' });
                        return;
                    }
                    break;

                case 'providers':
                    // إرسال لمزودي الخدمات فقط
                    console.log('🔍 جلب مزودي الخدمات...');
                    try {
                        const providersQuery = `SELECT user_id FROM public.users WHERE role = 'provider'`;
                        const providersResult = await servicesPool.query(providersQuery);
                        targetUsers = providersResult.rows.map(row => row.user_id);
                        console.log(`📡 إرسال لمزودي الخدمات: ${targetUsers.length} مستخدم`, targetUsers);
                    } catch (dbErr) {
                        console.error('❌ خطأ في جلب مزودي الخدمات:', dbErr);
                        socket.emit('notification_error', { error: 'فشل جلب مزودي الخدمات' });
                        return;
                    }
                    break;

                case 'admins':
                    // إرسال للمشرفين فقط
                    console.log('🔍 جلب المشرفين...');
                    try {
                        const adminsQuery = `SELECT user_id FROM public.users WHERE role = 'admin'`;
                        const adminsResult = await servicesPool.query(adminsQuery);
                        targetUsers = adminsResult.rows.map(row => row.user_id);
                        console.log(`📡 إرسال للمشرفين: ${targetUsers.length} مستخدم`, targetUsers);
                    } catch (dbErr) {
                        console.error('❌ خطأ في جلب المشرفين:', dbErr);
                        socket.emit('notification_error', { error: 'فشل جلب المشرفين' });
                        return;
                    }
                    break;

                case 'selected':
                    if (!targetUserIds || targetUserIds.length === 0) {
                        console.error('❌ يجب اختيار مستخدم واحد على الأقل');
                        socket.emit('notification_error', { error: 'يجب اختيار مستخدم واحد على الأقل' });
                        return;
                    }
                    targetUsers = targetUserIds;
                    console.log(`📡 إرسال للمستخدمين المختارين: ${targetUsers.length} مستخدم`, targetUsers);
                    break;

                default:
                    console.error(`❌ نوع استهداف غير صالح: ${targetType}`);
                    socket.emit('notification_error', { error: 'نوع استهداف غير صالح' });
                    return;
            }

            if (targetUsers.length === 0) {
                console.warn('⚠️ لا يوجد مستخدمين مستهدفين');
                socket.emit('notification_error', { error: 'لا يوجد مستخدمين مستهدفين' });
                return;
            }

            // إرسال الإشعار لكل مستخدم
            console.log(`🚀 بدء إرسال الإشعار إلى ${targetUsers.length} مستخدم...`);
            for (const userId of targetUsers) {
                try {
                    console.log(`💾 حفظ إشعار للمستخدم ${userId}...`);
                    // حفظ الإشعار في قاعدة البيانات
                    const insertQuery = `
                        INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
                        VALUES ($1, $2, $3, $4, false, NOW())
                        RETURNING id
                    `;
                    const result = await servicesPool.query(insertQuery, [userId, title, message, type || 'info']);
                    const notificationId = result.rows[0].id;
                    console.log(`✅ تم حفظ الإشعار ${notificationId} للمستخدم ${userId}`);

                    // إرسال الإشعار في الوقت الفعلي إذا كان المستخدم متصلاً
                    const targetSocketId = connectedUsers.get(userId);
                    if (targetSocketId) {
                        console.log(`📡 إرسال فوري للمستخدم ${userId} (Socket: ${targetSocketId})`);
                        io.to(targetSocketId).emit('new_notification', {
                            id: notificationId,
                            title,
                            message,
                            type: type || 'info',
                            created_at: new Date().toISOString()
                        });
                        sentCount++;
                    } else {
                        console.log(`💤 المستخدم ${userId} غير متصل، تم حفظ الإشعار فقط`);
                    }
                } catch (err) {
                    console.error(`❌ خطأ في إرسال إشعار للمستخدم ${userId}:`, err);
                }
            }

            console.log(`✅ تم إرسال الإشعار بنجاح إلى ${sentCount} مستخدم متصل، وحفظه لـ ${targetUsers.length} مستخدم`);

            socket.emit('notification_sent', {
                success: true,
                sentCount,
                totalTargeted: targetUsers.length
            });
        } catch (err) {
            console.error('❌ خطأ عام في إرسال الإشعار:', err);
            socket.emit('notification_error', { error: 'فشل إرسال الإشعار: ' + err.message });
        }
    });

    // طلب الإشعارات غير المقروءة
    socket.on('get_unread_notifications', async (data) => {
        console.log('📨 طلب الإشعارات غير المقروءة:', data);

        const userId = socket.auth.uid; // 🔒 لا يُقرأ إلا إشعارات صاحب التوكن

        if (!userId) {
            console.error('❌ معرف المستخدم مطلوب');
            socket.emit('notifications_error', { error: 'معرف المستخدم مطلوب' });
            return;
        }

        try {
            console.log('🔍 جلب الإشعارات للمستخدم:', userId);
            const query = `
                SELECT id, title, message, type, is_read, created_at, link
                FROM "public"."notifications"
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 50
            `;
            const result = await servicesPool.query(query, [userId]);
            console.log('✅ تم جلب', result.rows.length, 'إشعار للمستخدم', userId);
            socket.emit('unread_notifications', result.rows);
        } catch (err) {
            console.error('❌ خطأ في جلب الإشعارات:', err);
            socket.emit('notifications_error', { error: 'فشل جلب الإشعارات' });
        }
    });

    // تعليم إشعار كمقروء
    socket.on('mark_notification_read', async (notificationId) => {
        try {
            console.log('📖 تعليم الإشعار كمقروء:', notificationId);
            const query = `
                UPDATE "public"."notifications"
                SET is_read = true, read_at = NOW()
                WHERE id = $1
            `;
            await servicesPool.query(
                'UPDATE "public"."notifications" SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2',
                [notificationId, socket.auth.uid]
            ); // 🔒 لا يُعلَّم إلا إشعار يخص صاحب التوكن
            console.log('✅ تم تعليم الإشعار كمقروء وتسجيل وقت القراءة');
            socket.emit('notification_marked_read', { success: true });
        } catch (err) {
            console.error('❌ خطأ في تعليم الإشعار كمقروء:', err);
            socket.emit('notification_error', { error: 'فشل تعليم الإشعار' });
        }
    });
});

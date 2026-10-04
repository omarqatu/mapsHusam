// In-memory state shared by several route files: caches, who is online, and sending a notification.
import { servicesPool } from './database.js';

// إحصائيات المنصة العامة (/api/platform-stats): كاش 60 ثانية لكل مجموعة استثناءات، يُمسح عند الموافقة على نشاط
export const platformStatsCache = new Map();

// تخزين المستخدمين المتصلين مع معرفاتهم
export const connectedUsers = new Map(); // userId -> اسم غرفة المستخدم (user:<id>)، يُمرَّر لـ io.to() مباشرة
export const userRoom = (userId) => `user:${Number(userId)}`;

// دالة مساعدة: جلب سوكيت المستخدم المتصل حالياً (إن وجد) من نفس خريطة connectedUsers
export function getSocketIdForUser(userId) {
    return connectedUsers.get(userId) || connectedUsers.get(String(userId)) || connectedUsers.get(Number(userId));
}

// إشعار محفوظ بالجدول + دفعه فوراً إذا كان المستخدم متصلاً
export async function notifyUser(userId, title, message, type = 'info', link = null) {
    try {
        const saved = await servicesPool.query(
            `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at, link)
             VALUES ($1, $2, $3, $4, false, NOW(), $5) RETURNING id, created_at`,
            [userId, title, message, type, link]
        );
        const socketId = getSocketIdForUser(userId);
        if (socketId && global.io) {
            global.io.to(socketId).emit('new_notification', { id: saved.rows[0].id, title, message, type, link, created_at: saved.rows[0].created_at });
        }
    } catch (err) {
        console.error('⚠️ تعذر إرسال إشعار الطلب:', err.message);
    }
}

// قائمة المعالم المرتبطة بحساب مزوّد (/api/provider-linked-features، routes/provider-links.js)
// كاش 30 ثانية (يُمسح عند تعديل المستخدمين وعند الموافقة على نشاط)
export const providerLinkedCache = { data: null, expiresAt: 0 };
export function clearProviderLinkedCache() {
    providerLinkedCache.data = null;
    providerLinkedCache.expiresAt = 0;
}

// js/notifications.js - نظام الإشعارات في الوقت الفعلي

class NotificationSystem {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.isConnected = false;
        this.notificationCount = 0;
        this.notifications = [];
    }

    // تهيئة النظام
    init(userId) {
        this.userId = userId;
        this.connect();
    }

    // الاتصال بـ Socket.io
    connect() {
        if (this.socket) {
            console.log('🔌 Socket متصل بالفعل');
            return;
        }

        // الاتصال بالسيرفر
        this.socket = io();

        // عند الاتصال الناجح
        this.socket.on('connect', () => {
            console.log('✅ تم الاتصال بـ Socket.io');
            this.isConnected = true;

            // إرسال معرف المستخدم للسيرفر
            if (this.userId) {
                this.socket.emit('user_connected', this.userId);
            }
        });

        // تأكيد الاتصال من السيرفر
        this.socket.on('connection_confirmed', (data) => {
            console.log('🎯 تم تأكيد الاتصال:', data);
            this.updateConnectionStatus(true);
        });

        // استقبال إشعار جديد
        this.socket.on('new_notification', (notification) => {
            console.log('📨 إشعار جديد:', notification);
            this.notifications.unshift(notification);
            this.notificationCount++;
            this.showNotification(notification);
            this.updateNotificationBadge();
        });

        // استقبال الإشعارات غير المقروءة
        this.socket.on('unread_notifications', (notifications) => {
            console.log('📋 الإشعارات غير المقروءة:', notifications);
            this.notifications = notifications;
            this.notificationCount = notifications.length;
            this.updateNotificationBadge();
            this.renderNotificationDropdown(notifications);
            console.log('✅ تم عرض الإشعارات في القائمة');
        });

        // تأكيد إرسال الإشعار
        this.socket.on('notification_sent', (data) => {
            console.log('✅ تم إرسال الإشعار:', data);
            if (data.success) {
                alert('تم إرسال الإشعار بنجاح!');
            }
        });

        // خطأ في الإشعارات
        this.socket.on('notification_error', (error) => {
            console.error('❌ خطأ في الإشعارات:', error);
            alert('خطأ: ' + (error.error || 'حدث خطأ غير معروف'));
        });

        // تأكيد تعليم الإشعار كمقروء
        this.socket.on('notification_marked_read', (data) => {
            console.log('✅ تم تعليم الإشعار كمقروء:', data);
            if (data.success) {
                this.notificationCount--;
                this.updateNotificationBadge();
            }
        });

        // عند انقطاع الاتصال
        this.socket.on('disconnect', () => {
            console.log('🔌 انقطع الاتصال بـ Socket.io');
            this.isConnected = false;
            this.updateConnectionStatus(false);
        });

        // خطأ في الاتصال
        this.socket.on('connect_error', (error) => {
            console.error('❌ خطأ في الاتصال:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false);
        });
    }

    // إرسال إشعار لمستخدم معين
    sendNotification(targetUserId, title, message, type = 'info') {
        if (!this.socket || !this.isConnected) {
            alert('غير متصل بالسيرفر. يرجى المحاولة لاحقاً.');
            return;
        }

        this.socket.emit('send_notification', {
            targetUserId,
            title,
            message,
            type
        });
    }

    // طلب الإشعارات غير المقروءة
    getUnreadNotifications() {
        if (!this.socket || !this.isConnected) {
            console.warn('غير متصل بالسيرفر');
            return;
        }

        this.socket.emit('get_unread_notifications', this.userId);
    }

    // تعليم إشعار كمقروء
    markAsRead(notificationId) {
        if (!this.socket || !this.isConnected) {
            console.warn('غير متصل بالسيرفر');
            return;
        }

        this.socket.emit('mark_notification_read', notificationId);

        // تحديث العداد محلياً
        this.notificationCount--;
        this.updateNotificationBadge();
    }

    // عرض الإشعار للمستخدم
    showNotification(notification) {
        // استخدام إشعار المتصفح إذا كان مسموحاً
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico'
            });
        }

        // عرض إشعار مخصص في الواجهة
        this.showCustomNotification(notification);

        // تحديث القائمة المنبثقة
        this.updateNotificationDropdown();
    }

    // عرض إشعار مخصص في الواجهة
    showCustomNotification(notification) {
        const container = document.getElementById('notification-container');
        if (!container) {
            console.warn('حاوية الإشعارات غير موجودة');
            return;
        }

        const notificationEl = document.createElement('div');
        notificationEl.className = `notification-item notification-${notification.type || 'info'}`;
        notificationEl.innerHTML = `
            <div class="notification-content">
                <strong>${notification.title}</strong>
                <p>${notification.message}</p>
                <small>${new Date(notification.created_at).toLocaleString('ar')}</small>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        container.appendChild(notificationEl);

        // إزالة الإشعار تلقائياً بعد 5 ثواني
        setTimeout(() => {
            if (notificationEl.parentElement) {
                notificationEl.remove();
            }
        }, 5000);
    }

    // تحديث عداد الإشعارات
    updateNotificationBadge() {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            if (this.notificationCount > 0) {
                badge.textContent = this.notificationCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // تحديث حالة الاتصال
    updateConnectionStatus(connected) {
        const status = document.getElementById('connection-status');
        if (status) {
            if (connected) {
                status.className = 'status-connected';
                status.title = 'متصل';
            } else {
                status.className = 'status-disconnected';
                status.title = 'غير متصل';
            }
        }
    }

    // تحديث القائمة المنبثقة للإشعارات
    updateNotificationDropdown() {
        if (!this.socket || !this.isConnected) {
            return;
        }

        this.socket.emit('get_unread_notifications', this.userId);
    }

    // عرض الإشعارات في القائمة المنبثقة
    renderNotificationDropdown(notifications) {
        console.log('🎨 بدء عرض الإشعارات في القائمة...');
        const list = document.getElementById('notification-list');
        if (!list) {
            console.error('❌ عنصر notification-list غير موجود');
            return;
        }

        console.log('📊 عدد الإشعارات:', notifications.length);

        if (notifications.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">لا توجد إشعارات</p>';
            console.log('✅ لا توجد إشعارات للعرض');
            return;
        }

        list.innerHTML = '';
        notifications.forEach(notification => {
            const item = document.createElement('div');
            item.className = 'notification-dropdown-item unread';
            item.innerHTML = `
                <h4>${notification.title}</h4>
                <p>${notification.message}</p>
                <small>${new Date(notification.created_at).toLocaleString('ar')}</small>
            `;
            item.onclick = () => {
                this.markAsRead(notification.id);
                item.classList.remove('unread');
            };
            list.appendChild(item);
        });

        console.log('✅ تم عرض', notifications.length, 'إشعار في القائمة');
    }

    // تعليم جميع الإشعارات كمقروء
    markAllNotificationsAsRead() {
        if (!this.socket || !this.isConnected) {
            console.warn('غير متصل بالسيرفر');
            return;
        }

        // الحصول على جميع الإشعارات غير المقروءة من القائمة
        const unreadItems = document.querySelectorAll('.notification-dropdown-item.unread');
        unreadItems.forEach(item => {
            const notificationId = item.dataset.id;
            if (notificationId) {
                this.markAsRead(parseInt(notificationId));
            }
        });

        // تحديث القائمة
        this.updateNotificationDropdown();
    }

    // طلب إذن الإشعارات من المتصفح
    requestBrowserPermission() {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('✅ تم منح إذن الإشعارات');
                }
            });
        }
    }
}

// إنشاء نسخة عالمية من النظام
window.notificationSystem = new NotificationSystem();

// عند تحميل الصفحة، طلب إذن الإشعارات
window.addEventListener('DOMContentLoaded', () => {
    window.notificationSystem.requestBrowserPermission();

    // تفعيل زر الإشعارات
    const notificationBtn = document.getElementById('notification-toggle-btn');
    const notificationDropdown = document.getElementById('notification-dropdown');

    if (notificationBtn && notificationDropdown) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            console.log('🔔 تم النقر على زر الإشعارات');
            console.log('📊 Socket متصل:', window.notificationSystem?.isConnected);
            console.log('👤 userId:', window.notificationSystem?.userId);

            // عرض مؤشر التحميل
            const dropdownBody = notificationDropdown.querySelector('.notification-dropdown-body');
            if (dropdownBody) {
                dropdownBody.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">جاري تحميل الإشعارات...</p>';
            }

            // فتح القائمة
            notificationDropdown.classList.add('show');

            // طلب الإشعارات من السيرفر
            if (window.notificationSystem.socket && window.notificationSystem.userId) {
                console.log('🔄 طلب الإشعارات من السيرفر للمستخدم:', window.notificationSystem.userId);
                window.notificationSystem.socket.emit('get_unread_notifications', {
                    user_id: window.notificationSystem.userId
                });
            } else {
                console.warn('⚠️ Socket أو userId غير متاح');
                console.warn('Socket:', window.notificationSystem?.socket);
                console.warn('UserId:', window.notificationSystem?.userId);
                if (dropdownBody) {
                    dropdownBody.innerHTML = '<p style="text-align: center; color: #ea4335; padding: 20px;">لم يتم الاتصال بالسيرفر</p>';
                }
            }
        });

        // إغلاق القائمة عند النقر خارجها
        document.addEventListener('click', (e) => {
            if (!notificationDropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
                notificationDropdown.classList.remove('show');
            }
        });
    }
});

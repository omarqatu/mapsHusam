/**
 * auth-core-functions.js
 * يحتوي على الدوال الأساسية ومنطق التحكم في الواجهة للمستخدمين (مستخدم عادي، مزود خدمة، مشرف)
 */

window.currentAppUser = null;

// ==========================================
// دالة الإخفاء الصارم والمطلق لأزرار ولوحات التحرير الخاصة بالمشرف فقط عند بدء التشغيل
// ==========================================
function hideAllEditPanelsAndButtonsGlobally() {
    const panels = ["editPanel", "polygonEditPanel", "lineEditPanel"];
    const buttons = ["editBtn", "polygonEditBtn", "lineEditBtn"];

    panels.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty("display", "none", "important");
    });

    buttons.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty("display", "none", "important");
    });
}

// ==========================================
// دالة عرض شريط هوية المستخدم في الخريطة فوق يمين
// ==========================================
function showTopUserBadge(user) {
    const badgeContainer = document.getElementById('user-top-badge-container');
    const nameDisplay = document.getElementById('top-username-display');
    const roleDisplay = document.getElementById('top-userrole-display');
    const dashboardBtn = document.getElementById('dashboard-btn');

    if (badgeContainer && nameDisplay && roleDisplay) {
        badgeContainer.style.setProperty("display", "flex", "important");
        badgeContainer.classList.remove('hidden');

        // تنظيف الاسم من الإضافات المكررة وعرض الاسم الصافي
        const cleanName = user.full_name || user.name || 'مستخدم المنصة';
        const formattedName = cleanName.replace(" (مشرف المنصة)", "").replace(" (مزود)", "");
        nameDisplay.innerText = formattedName;

        // ترجمة الرتبة لعلامة ملونة مميزة وراقية
        roleDisplay.className = "user-badge-role"; // تصفير الكلاسات السابقة
        if (user.role === 'admin') {
            roleDisplay.innerText = "مشرف";
            roleDisplay.classList.add("role-admin");
            // إظهار زر لوحة التحكم للمشرف
            if (dashboardBtn) dashboardBtn.style.display = 'inline-flex';
        } else if (user.role === 'provider') {
            roleDisplay.innerText = "مزود خدمة";
            roleDisplay.classList.add("role-provider");
        } else {
            roleDisplay.innerText = "مستخدم";
            roleDisplay.classList.add("role-user");
        }
    }
}

// ==========================================
// التحكم في واجهة التحرير الجغرافية بناءً على الرتبة المعتمدة
// ==========================================
function applyMapInterfacePermissions() {
    if (!window.currentAppUser) return;
    const userRole = window.currentAppUser.role;
    
    const panels = ["editPanel", "polygonEditPanel", "lineEditPanel"];
    const buttons = ["editBtn", "polygonEditBtn", "lineEditBtn"];

    if (userRole === "admin") {
        
        buttons.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.setProperty("display", "inline-block", "important");
        });

        // إبقاء اللوحات الجانبية مخفية في البداية حتى يضغط على الزر المخصص لها
        panels.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.setProperty("display", "none", "important");
        });
    } else {
        
        buttons.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.setProperty("display", "none", "important");
        });

        panels.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.setProperty("display", "none", "important");
        });
    }
}

// ==========================================
// دالة الدخول وتفعيل النظام وتوزيع الصلاحيات وحفظ الجلسة
// ==========================================
function enterPlatform(userData, isAutoboot = false) {
    window.currentAppUser = userData;

    // حفظ الجلسة الموحدة في المتصفح لضمان عدم حدوث تشتت عند عمل Refresh
    localStorage.setItem('map_user', JSON.stringify(window.currentAppUser));

    // تطبيق الصلاحيات وبناء شريط الهوية
    applyMapInterfacePermissions();
    showTopUserBadge(window.currentAppUser);

    // تهيئة نظام الإشعارات
    if (window.notificationSystem && userData.user_id) {
        window.notificationSystem.init(userData.user_id);
        console.log('✅ تم تهيئة نظام الإشعارات للمستخدم:', userData.user_id);
    }

    // إظهار زر الإشعارات
    const notificationBtn = document.getElementById('notification-toggle-btn');
    if (notificationBtn) {
        notificationBtn.style.display = 'flex';
    }

    const authOverlay = document.getElementById('auth-splash-overlay');

    if (isAutoboot) {
        // في حالة الكشف التلقائي عن الجلسة، نعطي تأخيراً طفيفاً لضمان تحميل الملفات الأخرى في المتصفح
        setTimeout(() => {
            document.dispatchEvent(new CustomEvent("userLoggedIn", { detail: window.currentAppUser }));
        }, 150);

        if (authOverlay) authOverlay.style.display = 'none';
    } else {
        // في حالة تسجيل الدخول اليدوي الفوري
        document.dispatchEvent(new CustomEvent("userLoggedIn", { detail: window.currentAppUser }));

        if (authOverlay) {
            authOverlay.style.transition = "opacity 0.4s ease, visibility 0.4s";
            authOverlay.style.opacity = "0";
            authOverlay.style.visibility = "hidden";
            setTimeout(() => { authOverlay.remove(); }, 400);
        }
    }
}

// ==========================================
// دالة إرسال تتبع الإحصائيات إلى السيرفر الخارجي
// ==========================================
window.sendTrackingRequest = function(provider, service) {
    const serverUrl = window.location.origin + '/save-stat';
    const payload = {
        user_id: getRealUserId(),
        provider,
        service
    };
    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(serverUrl, blob);
        return Promise.resolve();
    }

    return fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
    }).catch(err => {
        console.error('خطأ في تسجيل الإحصائية:', err);
    });
};

// ==========================================
// دالة فتح لوحة التحكم
// ==========================================
window.openDashboard = function() {
    // فتح لوحة التحكم في نافذة جديدة
    window.open('/dashboard.html', '_blank');
};

// ==========================================
// دالة فتح رقم الموبايل
// ==========================================
window.openMobileContact = function() {
    // رقم الموبايل للتواصل
    const mobileNumber = '+970599000000'; // استبدل برقم الموبايل الفعلي
    window.sendTrackingRequest('الدومين', 'اتصال الهاتف الخارجي');
    window.open(`tel:${mobileNumber}`, '_blank');
};

// ==========================================
// دالة فتح واتساب
// ==========================================
window.openWhatsApp = function() {
    // رقم الواتساب للتواصل
    const whatsappNumber = '970599000000'; // استبدل برقم الواتساب الفعلي
    window.sendTrackingRequest('الدومين', 'واتساب خارجي');
    window.open(`https://wa.me/${whatsappNumber}`, '_blank');
};

// ==========================================
// دالة تسجيل الخروج وتطهير كامل لكاش المتصفح
// ==========================================
window.logoutPlatform = function() {
    if (confirm("هل أنت متأكد من رغبتك في تسجيل الخروج من المنصة؟")) {
        // جلب معرف المستخدم الحالي لتنظيف حالته الخاصة إن وجدت قبل مسح الجلسة
        try {
            const saved = localStorage.getItem('map_user');
            if (saved) {
                const parsed = JSON.parse(saved);
                const uid = parsed.user_id || parsed.id;
                if (uid) localStorage.removeItem(`provider_status_${uid}`);
            }
        } catch (e) {}

        localStorage.removeItem('map_user');
        sessionStorage.removeItem('map_user');
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        
        window.location.reload();
    }
}

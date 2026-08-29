/**
 * js/service-chat.js
 */
(function () {
    'use strict';

    let currentOpenRequestId = null;
    let currentUserRoleInChat = null; // 'user' أو 'provider'
    let pollMessagesInterval = null;
    let pollRequestsInterval = null;
    let lastHandledPendingReqId = null;
    let requestRingAudio = null;
    let requestRingTimeout = null;
    let isRequestingService = false; // لمنع النقر المزدوج
    let lastRequestTimestamp = 0; // لتتبع وقت آخر طلب تم استلامه
    let pollingDisabledUntil = 0; // لتعطيل polling حتى وقت معين
    let handledRequests = new Map(); // لتتبع الطلبات التي تم معالجتها مع timestamp

    function playRequestRing() {
        // إيقاف أي رنة سابقة
        stopRequestRing();

        // إنشاء صوت الرنة
        try {
            // استخدام ملف محلي في مجلد sounds
            // إذا لم يكن الملف موجوداً، سيتم استخدام رابط من الإنترنت كبديل
            requestRingAudio = new Audio('/sounds/notification-ring.mp3');
            requestRingAudio.loop = true;
            requestRingAudio.volume = 0.5;
            requestRingAudio.preload = 'auto';
            
            // محاولة تشغيل الصوت مع معالجة سياسة المتصفح
            const playPromise = requestRingAudio.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                }).catch(err => {
                    // استخدام رنين من الإنترنت كبديل
                    requestRingAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                    requestRingAudio.loop = true;
                    requestRingAudio.volume = 0.5;
                });
            }

            // إيقاف الرنة بعد 5 ثوانٍ
            requestRingTimeout = setTimeout(() => {
                stopRequestRing();
            }, 5000);
        } catch (err) {
        }
    }

    function stopRequestRing() {
        if (requestRingAudio) {
            requestRingAudio.pause();
            requestRingAudio.currentTime = 0;
            requestRingAudio = null;
        }
        if (requestRingTimeout) {
            clearTimeout(requestRingTimeout);
            requestRingTimeout = null;
        }
    } 
    let currentOtherPartyName = ''; 
    let currentServiceTypeLabel = ''; 

    function getCurrentUser() {
        try {
            const raw = localStorage.getItem('map_user') || sessionStorage.getItem('map_user') ||
                        localStorage.getItem('user') || sessionStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function getCurrentUserId() {
        const u = getCurrentUser();
        return u ? (u.user_id || u.id) : (window.getRealUserId ? window.getRealUserId() : null);
    }

    function normalizeWhatsappNumber(rawWhatsapp) {
        if (!rawWhatsapp) return '';
        let digits = String(rawWhatsapp).replace(/\D/g, '');
        if (!digits) return '';
        if (digits.startsWith('00')) {
            digits = digits.substring(2);
        }
        if ((digits.startsWith('970') || digits.startsWith('972')) && digits.length >= 12) {
            return digits.slice(0, 12);
        }
        if (digits.length === 10 && digits.startsWith('0')) {
            return '970' + digits.substring(1);
        }
        if (digits.length === 9 && digits.startsWith('5')) {
            return '970' + digits;
        }
        return digits;
    }

    function deriveLocalPhoneFromWhatsapp(rawWhatsapp) {
        const normalized = normalizeWhatsappNumber(rawWhatsapp);
        if (!normalized) return '';
        if ((normalized.startsWith('970') || normalized.startsWith('972')) && normalized.length === 12 && normalized[3] === '5') {
            return '0' + normalized.substring(3);
        }
        if (normalized.length === 10 && normalized.startsWith('0')) {
            return normalized;
        }
        if (normalized.length === 9 && normalized.startsWith('5')) {
            return '0' + normalized;
        }
        return normalized;
    }

    // ==========================================================================
    // إدارة حالة النشاط غير المقروء (مربوطة بالمعرف والطلب لتحديد العنصر بدقة)
    // ==========================================================================
    function getUnseenFlagKey() {
        const uid = getCurrentUserId();
        return 'svc_unseen_activity_' + (uid || 'guest');
    }
    
    function setUnseenActivityFlag(value, reqId = null) {
        try {
            if (value) {
                localStorage.setItem(getUnseenFlagKey(), '1');
                if (reqId) {
                    localStorage.setItem(getUnseenFlagKey() + '_req_' + reqId, '1');
                }
            } else {
                localStorage.removeItem(getUnseenFlagKey());
                const uid = getCurrentUserId() || 'guest';
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('svc_unseen_activity_' + uid + '_req_')) {
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (e) {}
    }

    function getUnseenActivityFlag() {
        try { return localStorage.getItem(getUnseenFlagKey()) === '1'; } catch (e) { return false; }
    }

    function isRequestUnseen(reqId) {
        try {
            const uid = getCurrentUserId() || 'guest';
            return localStorage.getItem('svc_unseen_activity_' + uid + '_req_' + reqId) === '1';
        } catch (e) { return false; }
    }

    function clearRequestUnseen(reqId) {
        try {
            const uid = getCurrentUserId() || 'guest';
            localStorage.removeItem('svc_unseen_activity_' + uid + '_req_' + reqId);
            
            // تحقق ما إذا كان هناك أي طلبات أخرى لا تزال غير مقروءة
            let hasAnyOtherUnseen = false;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('svc_unseen_activity_' + uid + '_req_')) {
                    hasAnyOtherUnseen = true;
                    break;
                }
            }
            // إذا لم يعد هناك أي طلب غير مقروء، قم بإطفاء التوهج العام بالكامل
            if (!hasAnyOtherUnseen) {
                localStorage.removeItem(getUnseenFlagKey());
                const btn = getProfileToggleBtn();
                if (btn) btn.classList.remove('svc-requests-glow');
                if (myRequestsBtn) myRequestsBtn.classList.remove('svc-requests-glow');
            }
        } catch (e) {}
    }

    // ==========================================================================
    // نظام الإشعارات المنبثقة واللطيفة (Toast & Confirm)
    // ==========================================================================
    let toastContainer;

    function buildToastContainer() {
        if (toastContainer) return;
        toastContainer = document.createElement('div');
        toastContainer.id = 'svc-toast-container';
        toastContainer.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            z-index: 2147483647; display: flex; flex-direction: column; gap: 10px;
            align-items: center; width: 100%; max-width: 380px; padding: 0 15px;
            box-sizing: border-box; pointer-events: none;
        `;
        document.body.appendChild(toastContainer);

        if (!document.getElementById('svc-toast-anim-style')) {
            const style = document.createElement('style');
            style.id = 'svc-toast-anim-style';
            style.innerHTML = `
                @keyframes svcToastIn { from { opacity:0; transform: translateY(-14px) scale(0.97); } to { opacity:1; transform: translateY(0) scale(1); } }
                @keyframes svcToastOut { from { opacity:1; transform: translateY(0) scale(1); } to { opacity:0; transform: translateY(-10px) scale(0.97); } }
                .svc-toast-item { animation: svcToastIn 0.28s ease forwards; }
                .svc-toast-item.svc-toast-closing { animation: svcToastOut 0.22s ease forwards; }
            `;
            document.head.appendChild(style);
        }
    }

    // جعل دالة toast متاحة عالمياً
    window.toast = function(message, type = 'info', duration = 4200) {
        buildToastContainer();
        const palette = {
            success: { bg: '#eafaf0', border: '#28a745', icon: 'fa-circle-check', color: '#1e7e34' },
            error:   { bg: '#fdecea', border: '#dc3545', icon: 'fa-circle-exclamation', color: '#c0392b' },
            warning: { bg: '#fff8e6', border: '#e67e22', icon: 'fa-triangle-exclamation', color: '#b06000' },
            info:    { bg: '#eaf2fe', border: '#1a73e8', icon: 'fa-circle-info', color: '#1a5fb4' }
        };
        const p = palette[type] || palette.info;

        const item = document.createElement('div');
        item.className = 'svc-toast-item';
        item.style.cssText = `
            pointer-events: auto; width: 100%; background: ${p.bg}; border-right: 4px solid ${p.border};
            border-radius: 10px; padding: 12px 14px; box-shadow: 0 6px 20px rgba(0,0,0,0.15);
            display: flex; align-items: flex-start; gap: 10px; direction: rtl; font-size: 13px;
            color: #333; line-height: 1.6;
        `;
        item.innerHTML = `
            <i class="fas ${p.icon}" style="color:${p.color}; font-size:16px; margin-top:2px;"></i>
            <div style="flex:1;">${message}</div>
            <button style="background:none; border:none; color:#999; cursor:pointer; font-size:14px; line-height:1; padding:0 2px;">✕</button>
        `;

        const closeBtn = item.querySelector('button');
        let dismissTimer = setTimeout(() => dismiss(), duration);

        function dismiss() {
            clearTimeout(dismissTimer);
            item.classList.add('svc-toast-closing');
            setTimeout(() => item.remove(), 220);
        }

        closeBtn.onclick = dismiss;
        toastContainer.appendChild(item);
    }

    function confirmDialog(message, options = {}) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 300500;
                display: flex; align-items: center; justify-content: center; direction: rtl; padding: 15px; box-sizing: border-box;
            `;
            const box = document.createElement('div');
            box.style.cssText = `
                background:#fff; width:100%; max-width:380px; border-radius:14px; padding:22px;
                box-shadow:0 15px 40px rgba(0,0,0,0.3); text-align:center; animation: svcToastIn 0.22s ease;
            `;
            box.innerHTML = `
                <div style="font-size:32px; color:#1a73e8; margin-bottom:10px;"><i class="fas fa-circle-question"></i></div>
                <div style="font-size:14px; color:#333; line-height:1.7; margin-bottom:20px;">${message}</div>
                <div style="display:flex; gap:10px;">
                    <button id="svc-confirm-ok" style="flex:1; background:#1a73e8; color:#fff; border:none; padding:11px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;">${options.okText || 'متابعة'}</button>
                    <button id="svc-confirm-cancel" style="flex:1; background:#f1f3f4; color:#444; border:none; padding:11px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;">${options.cancelText || 'إلغاء'}</button>
                </div>
            `;
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const cleanup = (result) => { overlay.remove(); resolve(result); };
            box.querySelector('#svc-confirm-ok').onclick = () => cleanup(true);
            box.querySelector('#svc-confirm-cancel').onclick = () => cleanup(false);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
        });
    }

    function promptDialog(title, defaultValue = '', options = {}) {
    const required = options.required === true;
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 300500;
            display: flex; align-items: center; justify-content: center; direction: rtl; padding: 15px; box-sizing: border-box;
        `;
        const box = document.createElement('div');
        box.style.cssText = `
            background:#fff; width:100%; max-width:380px; border-radius:14px; padding:22px;
            box-shadow:0 15px 40px rgba(0,0,0,0.3); animation: svcToastIn 0.22s ease;
        `;
        box.innerHTML = `
            <div style="font-size:14px; color:#333; font-weight:bold; margin-bottom:10px;">${title}</div>
            <textarea id="svc-prompt-input" rows="3" placeholder="${required ? 'اكتب السبب هنا (إجباري)...' : ''}" style="width:100%; box-sizing:border-box; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:13px; font-family:inherit; resize:vertical; direction:rtl;">${defaultValue}</textarea>
            <div id="svc-prompt-error" style="display:none; color:#dc3545; font-size:12px; margin-top:6px; font-weight:bold;">⚠️ هذا الحقل إجباري، يرجى كتابة نص واضح قبل المتابعة.</div>
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button id="svc-prompt-ok" style="flex:1; background:#28a745; color:#fff; border:none; padding:11px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;">تأكيد</button>
                <button id="svc-prompt-cancel" style="flex:1; background:#f1f3f4; color:#444; border:none; padding:11px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;">إلغاء</button>
            </div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const input = box.querySelector('#svc-prompt-input');
        const errorLine = box.querySelector('#svc-prompt-error');
        input.focus();
        input.select();

        const cleanup = (result) => { overlay.remove(); resolve(result); };

        box.querySelector('#svc-prompt-ok').onclick = () => {
            const val = input.value.trim();
            if (required && !val) {
                // 🆕 لا يُغلق المودال ولا يُتابع أي إجراء بدون نص حقيقي يكتبه المستخدم بنفسه
                errorLine.style.display = 'block';
                input.style.borderColor = '#dc3545';
                input.focus();
                return;
            }
            cleanup(val || defaultValue);
        };
        box.querySelector('#svc-prompt-cancel').onclick = () => cleanup(null);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
    });
}

    let chatModal, chatBody, chatInput, chatHeaderTitle, chatConfirmBtn, chatCancelBtn, chatStatusLine;
    let incomingBanner;
    let myRequestsBtn; 

    function getProfileToggleBtn() {
        return document.querySelector('.ui-profile-toggle-btn');
    }

    // ==========================================================================
    // حقن وتحديث ستايلات التوهج المتقدمة للمكونات
    // ==========================================================================
    function injectRequestsGlowStyle() {
        if (document.getElementById('svc-requests-glow-style')) return;
        const style = document.createElement('style');
        style.id = 'svc-requests-glow-style';
        style.innerHTML = `
            @keyframes svcRequestsGlow {
                0%   { box-shadow: 0 0 0 0 rgba(37,211,102,0.75), 0 0 0 0 rgba(37,211,102,0.35); border-color:#25d366; transform: scale(1); }
                22%  { box-shadow: 0 0 16px 6px rgba(37,211,102,0.85), 0 0 32px 14px rgba(37,211,102,0.4); border-color:#25d366; transform: scale(1.14); }
                45%  { box-shadow: 0 0 0 0 rgba(37,211,102,0.75); border-color:#25d366; transform: scale(1); }
                50%  { box-shadow: 0 0 0 0 rgba(26,115,232,0.75), 0 0 0 0 rgba(26,115,232,0.35); border-color:#1a73e8; transform: scale(1); }
                72%  { box-shadow: 0 0 16px 6px rgba(26,115,232,0.85), 0 0 32px 14px rgba(26,115,232,0.4); border-color:#1a73e8; transform: scale(1.14); }
                95%, 100% { box-shadow: 0 0 0 0 rgba(26,115,232,0.75); border-color:#1a73e8; transform: scale(1); }
            }
            @keyframes svcRequestsIconColor {
                0%, 45%  { color:#25d366; }
                50%, 95% { color:#1a73e8; }
                100%     { color:#25d366; }
            }
            @keyframes svcCardPulse {
                0%   { border-color: #25d366; box-shadow: 0 0 0 rgba(37,211,102,0.4); }
                50%  { border-color: #1a73e8; box-shadow: 0 0 12px rgba(26,115,232,0.6); }
                100% { border-color: #25d366; box-shadow: 0 0 0 rgba(37,211,102,0.4); }
            }
            .ui-profile-toggle-btn.svc-requests-glow {
                animation: svcRequestsGlow 1.7s ease-in-out infinite;
                border: 3px solid #25d366 !important;
                z-index: 100010;
            }
            .ui-profile-toggle-btn.svc-requests-glow i,
            #open-my-service-chats.svc-requests-glow i {
                animation: svcRequestsIconColor 1.7s ease-in-out infinite;
            }
            #open-my-service-chats.svc-requests-glow {
                animation: svcRequestsGlow 1.7s ease-in-out infinite;
                border: 2px solid #25d366 !important;
                background: #eafaf0 !important;
            }
            .svc-request-card-glow {
                animation: svcCardPulse 1.8s infinite ease-in-out !important;
                border-width: 2px !important;
                background: #f0f7ff !important;
            }
        `;
        document.head.appendChild(style);
    }

    function applyGlowToProfileBtn() {
        let applied = false;
        const btn = getProfileToggleBtn();
        if (btn) {
            btn.classList.add('svc-requests-glow');
            applied = true;
        }
        if (myRequestsBtn) {
            myRequestsBtn.classList.add('svc-requests-glow');
            applied = true;
        }
        return applied;
    }

    function triggerPulseEffect(reqId = null) {
        injectRequestsGlowStyle();
        setUnseenActivityFlag(true, reqId); 

        if (!applyGlowToProfileBtn()) {
            let attempts = 0;
            const retryTimer = setInterval(() => {
                attempts++;
                if (applyGlowToProfileBtn() || attempts > 30) clearInterval(retryTimer);
            }, 400);
        }
    }

    function removePulseEffect(reqId = null) {
        if (reqId) {
            clearRequestUnseen(reqId);
        } else {
            setUnseenActivityFlag(false);
            const btn = getProfileToggleBtn();
            if (btn) btn.classList.remove('svc-requests-glow');
            if (myRequestsBtn) myRequestsBtn.classList.remove('svc-requests-glow');
        }
    }

    function restoreGlowStateIfNeeded() {
        // لا نعيد التوهج إذا تم إزالته مسبقاً
        // التوهج يجب أن يظهر فقط عند طلبات جديدة، وليس عند إعادة تحميل الصفحة
        const hasUnseen = getUnseenActivityFlag();
        
        if (hasUnseen) {
            triggerPulseEffect();
        }
    }

    function insertMyRequestsButtonIntoDrawer() {
        if (document.getElementById('open-my-service-chats')) return true; 

        const drawerBody = document.querySelector('.ui-profile-drawer-body');
        if (!drawerBody) return false;

        myRequestsBtn = document.createElement('button');
        myRequestsBtn.id = 'open-my-service-chats';
        myRequestsBtn.type = 'button';
        myRequestsBtn.className = 'btn-guide-top'; 
        myRequestsBtn.innerHTML = '<i class="fas fa-headset"></i> طلباتي';
        
        if (getUnseenActivityFlag()) {
            myRequestsBtn.classList.add('svc-requests-glow');
        }

        myRequestsBtn.onclick = () => {
            // إزالة التوهج عند فتح قائمة الطلبات
            removePulseEffect();
            showActiveRequestsList();
            const container = document.getElementById('user-top-badge-container');
            if (container) container.classList.remove('ui-profile-open');
        };

        const divider = drawerBody.querySelector('.ui-profile-drawer-divider');
        if (divider) {
            drawerBody.insertBefore(myRequestsBtn, divider);
        } else {
            drawerBody.appendChild(myRequestsBtn);
        }
        return true;
    }

    function ensureMyRequestsButton() {
        if (insertMyRequestsButtonIntoDrawer()) return;
        let attempts = 0;
        const retryTimer = setInterval(() => {
            attempts++;
            if (insertMyRequestsButtonIntoDrawer() || attempts > 30) clearInterval(retryTimer);
        }, 400);
    }

    function buildUI() {
       
        ensureMyRequestsButton(); 

        if (!incomingBanner) {
            incomingBanner = document.createElement('div');
            incomingBanner.id = 'service-incoming-banner';
            incomingBanner.style.cssText = `
                display: none; position: fixed; top: 20px; right: 20px; z-index: 200400;
                background: #fff; border: 1px solid #ccd0d5; border-radius: 10px;
                padding: 15px; width: 320px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); direction: rtl;
                animation: svcToastIn 0.3s ease;
            `;
            document.body.appendChild(incomingBanner);
            
        }

        if (document.getElementById('service-chat-modal')) return;

        chatModal = document.createElement('div');
        chatModal.id = 'service-chat-modal';
        chatModal.style.cssText = `
            display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55);
            z-index:200500; align-items:center; justify-content:center; direction:rtl; padding:15px; box-sizing:border-box;
        `;
        chatModal.innerHTML = `
            <div style="background:#fff; width:100%; max-width:420px; max-height:85vh; border-radius:14px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 15px 40px rgba(0,0,0,0.35);">
                <div style="background:linear-gradient(135deg,#1a73e8,#6c5ce7); color:#fff; padding:14px 16px; display:flex; justify-content:space-between; align-items:center;">
                    <strong id="service-chat-title" style="font-size:15px;"><i class="fas fa-comments"></i> دردشة الطلب</strong>
                    <button id="service-chat-close-btn" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:28px; height:28px; border-radius:50%; cursor:pointer; font-size:14px;">✕</button>
                </div>
                <div id="service-chat-status" style="padding:10px 14px; font-size:12px; color:#555; background:#f8f9fa; border-bottom:1px solid #eee;"></div>
                <div id="service-chat-body" style="flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:8px; background:#f4f6f8; min-height:200px;"></div>
                <div id="service-chat-input-area" style="padding:10px; border-top:1px solid #eee; display:flex; gap:8px;">
                    <input id="service-chat-input" type="text" placeholder="اكتب رسالتك..." style="flex:1; padding:10px; border:1px solid #ccc; border-radius:20px; font-size:13px;">
                    <button id="service-chat-send-btn" style="background:#1a73e8; color:#fff; border:none; width:40px; height:40px; border-radius:50%; cursor:pointer;"><i class="fas fa-paper-plane"></i></button>
                </div>
                <div style="padding:10px 14px 14px; display:flex; gap:8px;">
                    <button id="service-chat-confirm-btn" style="flex:2; background:#28a745; color:#fff; border:none; padding:11px; border-radius:8px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                        <i class="fas fa-handshake"></i> تم الاتفاق ✅
                    </button>
                    <button id="service-chat-cancel-req-btn" style="flex:1; background:#dc3545; color:#fff; border:none; padding:11px; border-radius:8px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; font-size:13px;">
                        <i class="fas fa-ban"></i> إلغاء الطلب
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(chatModal);

        chatBody = document.getElementById('service-chat-body');
        chatInput = document.getElementById('service-chat-input');
        chatHeaderTitle = document.getElementById('service-chat-title');
        chatConfirmBtn = document.getElementById('service-chat-confirm-btn');
        chatCancelBtn = document.getElementById('service-chat-cancel-req-btn');
        chatStatusLine = document.getElementById('service-chat-status');

        document.getElementById('service-chat-close-btn').onclick = closeChatModal;
        document.getElementById('service-chat-send-btn').onclick = sendChatMessage;
        chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChatMessage(); });
        chatConfirmBtn.onclick = confirmAgreement;

        chatCancelBtn.onclick = async () => {
    if (!currentOpenRequestId) return;
    // 🆕 لا يوجد نص افتراضي جاهز - المستخدم مُلزَم بكتابة سبب حقيقي بنفسه
    const reason = await promptDialog('يرجى كتابة سبب إلغاء الطلب:', '', { required: true });
    if (reason === null) return;

    const userId = getCurrentUserId();
    try {
        const cancelRes = await fetch(`${window.location.origin}/api/service-requests/${currentOpenRequestId}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, role: currentUserRoleInChat, cancellation_reason: reason.trim() })
        });
                const cancelData = await cancelRes.json();
                if (cancelData.success) {
                    toast('✅ تم إلغاء الطلب بنجاح.', 'success');
                    closeChatModal();
                } else {
                    toast('❌ ' + (cancelData.error || 'تعذر إلغاء الطلب.'), 'error');
                }
            } catch (err) {
                toast('حدث خطأ أثناء الاتصال بالسيرفر.', 'error');
            }
        };
    }

    function renderContactDetailsBox(targetUserObj, otherPartyName, serviceType) {
        if (!targetUserObj) {
            return '<b>تم الاتفاق بنجاح!</b> أرقام التواصل: غير متوفرة حالياً';
        }
        // 🆕 استخدام البيانات الصحيحة:
        // - مزود الخدمة: من المعلم (feature) - providerPhone و providerWhatsapp
        // - المستخدم: من جدول users - userPhone و userWhatsapp
        let rawWhatsapp = targetUserObj.whatsapp || targetUserObj.whatsapp_number || '';
        let rawPhone = targetUserObj.phone || '';

        if (typeof targetUserObj === 'string' || typeof targetUserObj === 'number') {
            rawWhatsapp = String(targetUserObj);
            rawPhone = '';
        }

        const cleanWhatsapp = rawWhatsapp ? String(rawWhatsapp).trim() : '';
        const normalizedWhatsappDigits = cleanWhatsapp ? normalizeWhatsappNumber(cleanWhatsapp) : '';
        // 🆕 استخدام phone مباشرة
        const phoneVal = rawPhone && String(rawPhone).trim() !== '' ? String(rawPhone).trim() : deriveLocalPhoneFromWhatsapp(cleanWhatsapp);

        if (!normalizedWhatsappDigits && !phoneVal) {
            return '<b>تم الاتفاق بنجاح!</b> أرقام التواصل: غير متوفرة';
        }

        const waLinkNumber = normalizedWhatsappDigits;

        const greetName = (otherPartyName && otherPartyName.trim()) ? otherPartyName.trim() : 'الطرف الآخر';
        const greetService = (serviceType && serviceType.trim()) ? serviceType.trim() : 'الخدمة';
        const waMessage = `مرحباً ${greetName}، تواصلت معاك بخصوص خدمة (${greetService}) من خلال منصة خريطة الخدمات الفلسطينية.`;
        const waMessageEncoded = encodeURIComponent(waMessage);

        return `
            <div style="background:#e8f5e9; border:1px solid #c8e6c9; border-radius:8px; padding:10px; text-align:center;">
                <div style="color:#2e7d32; font-weight:bold; margin-bottom:8px; font-size:13px;">🎉 تم الاتفاق بنجاح! وسائل التواصل المتاحة:</div>
                <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                    ${phoneVal ? `<a href="tel:${phoneVal}" style="background:#28a745; color:#fff; padding:7px 14px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:12px; display:flex; align-items:center; gap:5px;">
                        <i class="fas fa-phone-alt"></i> اتصال (${phoneVal})
                    </a>` : ''}
                    ${waLinkNumber ? `<a href="https://api.whatsapp.com/send?phone=${waLinkNumber}&text=${waMessageEncoded}" target="_blank" style="background:#25d366; color:#fff; padding:7px 14px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:12px; display:flex; align-items:center; gap:5px;">
                        <i class="fab fa-whatsapp"></i> واتساب (${cleanWhatsapp})
                    </a>` : ''}
                </div>
            </div>
        `;
    }

    async function openChatModal(requestId, role, otherPartyLabel, isCompletedStatus = false, contactData = null, serviceType = '') {
        buildUI();
        currentOpenRequestId = requestId;
        currentUserRoleInChat = role;
        currentOtherPartyName = otherPartyLabel || '';
        currentServiceTypeLabel = serviceType || '';

        // [حل الثغرة الأولى] مسح حالة "غير المقروء" لهذا الطلب المعين فور فتحه لإطفاء التوهج
        removePulseEffect(requestId);
        
        chatConfirmBtn.disabled = false;
        chatConfirmBtn.style.opacity = '1';
        chatConfirmBtn.style.display = 'flex';
        chatConfirmBtn.innerHTML = '<i class="fas fa-handshake"></i> تم الاتفاق ✅';
        
        chatHeaderTitle.innerHTML = `<i class="fas fa-comments"></i> دردشة مع ${otherPartyLabel}`;
        
        const inputArea = document.getElementById('service-chat-input-area');

        // [حل الثغرة الثانية] إذا كان الطلب مكتملاً وفي الأرشيف، نخفي زر الإلغاء تماماً لمنع التلاعب
        if (isCompletedStatus) {
            chatStatusLine.innerHTML = renderContactDetailsBox(contactData, currentOtherPartyName, currentServiceTypeLabel);
            chatConfirmBtn.disabled = true;
            chatConfirmBtn.style.opacity = '0.6';
            chatConfirmBtn.innerHTML = '<i class="fas fa-check-circle"></i> تم الاتفاق فعلياً (أرشيف)';
            if (inputArea) inputArea.style.display = 'none';
            if (chatCancelBtn) chatCancelBtn.style.display = 'none'; // إخفاء زر الإلغاء في مودال الأرشيف
        } else {
            chatStatusLine.textContent = 'تناقش مع الطرف الآخر، وعند الاتتمام اضغط كل طرف على "تم الاتفاق".';
            if (inputArea) inputArea.style.display = 'flex';
            if (chatCancelBtn) chatCancelBtn.style.display = 'flex'; // إظهار زر الإلغاء للطلبات النشطة
        }

        chatBody.innerHTML = '<div style="text-align:center; color:#999; font-size:12px;">جاري تحميل الرسائل...</div>';
        chatModal.style.display = 'flex';

        await loadMessages();

        if (!isCompletedStatus) {
            if (pollMessagesInterval) clearInterval(pollMessagesInterval);
            pollMessagesInterval = setInterval(loadMessages, 4000);
        } else {
            if (pollMessagesInterval) { clearInterval(pollMessagesInterval); pollMessagesInterval = null; }
        }
    }

    function closeChatModal() {
        if (chatModal) chatModal.style.display = 'none';
        currentOpenRequestId = null;
        if (pollMessagesInterval) { clearInterval(pollMessagesInterval); pollMessagesInterval = null; }
        
        // لا تزيل مودال التقييم عند إغلاق الدردشة
        const ratingModal = document.getElementById('rating-modal');
        if (ratingModal && ratingModal.dataset.protected === 'true') {
            // المودال محمي، لا تزله
        }
    }

    // ==========================================================================
    // قائمة الطلبات مع معالجة حظر الإلغاء للطلبات المنتهية والمكتملة
    // ==========================================================================
    async function showActiveRequestsList() {
        const userId = getCurrentUserId();
        if (!userId) {
            toast('يرجى تسجيل الدخول أولاً.', 'warning');
            return;
        }
        try {
            const res = await fetch(`${window.location.origin}/api/service-requests?user_id=${userId}`);
            const data = await res.json();
            if (!data.success || !data.requests || data.requests.length === 0) {
                toast('لا توجد طلبات خدمة نشطة أو سابقة حالياً.', 'info');
                return;
            }

            const existingModal = document.getElementById('active-req-modal');
            if (existingModal) existingModal.remove();

            const modalWrapper = document.createElement('div');
            modalWrapper.id = 'active-req-modal';
            modalWrapper.style.cssText = `
                position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 210000;
                display: flex; align-items: center; justify-content: center; direction: rtl; padding: 15px;
            `;

            const contentBox = document.createElement('div');
            contentBox.style.cssText = `
                background: #fff; width: 100%; max-width: 400px; border-radius: 12px;
                padding: 20px; max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            `;

            contentBox.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                    <h3 style="margin:0; font-size:16px; color:#1a73e8;"><i class="fas fa-list"></i> طلباتي والدردشات</h3>
                    <button id="close-active-req-modal-btn" style="background:none; border:none; font-size:18px; cursor:pointer; font-weight:bold;">✕</button>
                </div>
                <div style="display:flex; flex-direction:column; gap:10px;" id="active-requests-list-container"></div>
            `;

            modalWrapper.appendChild(contentBox);
            document.body.appendChild(modalWrapper);

            document.getElementById('close-active-req-modal-btn').onclick = () => {
                modalWrapper.remove();
                checkPendingComments(); // التحقق من التعليقات المعلقة عند الإغلاق
            };

            const container = contentBox.querySelector('#active-requests-list-container');

            data.requests.forEach(r => {
                const isAccepted = r.status === 'accepted';
                const isCompleted = r.status === 'completed';
                const isPending = r.status === 'pending';
                const isMyRequest = String(r.user_id) === String(userId);
                const hasUnseenActivity = isRequestUnseen(r.id);

                let statusText = '⏳ بانتظار الرد';
                let statusColor = '#e67e22';
                if (isCompleted) {
                    statusText = '✅ تم الاتفاق (أرشيف غير فعال)';
                    statusColor = '#28a745';
                } else if (isAccepted) {
                    statusText = '💬 مقبولة (فتح الدردشة)';
                    statusColor = '#1a73e8';
                } else if (r.status === 'rejected') {
                    statusText = '❌ مرفوض';
                    statusColor = '#dc3545';
                } else if (r.status === 'cancelled') {
                    statusText = `🚫 ملغي (${r.cancellation_reason || 'بدون سبب'})`;
                    statusColor = '#6c757d';
                }

                                const chatRole = String(r.provider_user_id) === String(userId) ? 'provider' : 'user';
                // 🆕 [إصلاح الاسم بين القوسين]: نقرات الاتصال/الواتساب المباشرة
                
                const isDirectContactRecord = r.contact_type === 'call' || r.contact_type === 'whatsapp';
                const otherPartyName = isDirectContactRecord
                    ? (r.provider_name || 'مزود الخدمة')
                    : (chatRole === 'provider' ? (r.user_name || 'المستخدم الطالب') : (r.provider_name || 'مزود الخدمة'));

                const card = document.createElement('div');
                card.className = hasUnseenActivity ? 'svc-request-card-glow' : '';
                card.style.cssText = `
                    background:${hasUnseenActivity ? '#f0f7ff' : '#f8f9fa'}; 
                    border:1px solid ${hasUnseenActivity ? '#1a73e8' : '#e0e0e0'}; 
                    border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:6px;
                `;
                card.innerHTML = `
                    <div style="font-weight:bold; font-size:14px; color:#333; display:flex; justify-content:space-between; align-items:center;">
                        <span>${r.service_type || 'خدمة هندسية/عقارية'} (${otherPartyName})</span>
                        ${hasUnseenActivity ? '<span style="background:#25d366; color:#fff; font-size:10px; padding:2px 6px; border-radius:10px; font-weight:bold;">جديد!</span>' : ''}
                    </div>
                    <div style="font-size:12px; color:${statusColor}; font-weight:bold;">الحالة: ${statusText}</div>
                `;

                if (isAccepted || isCompleted) {
                    const chatBtn = document.createElement('button');
                    chatBtn.innerHTML = isCompleted ? '<i class="fas fa-archive"></i> عرض الأرشيف وأرقام التواصل' : '<i class="fas fa-comments"></i> فتح الدردشة / التفاصيل';
                    chatBtn.style.cssText = isCompleted ? 'background:#6c757d; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:12px; margin-top:4px; font-weight:bold;' : 'background:#1a73e8; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:12px; margin-top:4px; font-weight:bold;';
                    chatBtn.onclick = () => {
                        modalWrapper.remove();
                        // 🆕 استخدام البيانات الصحيحة:
                        // - مزود الخدمة: من المعلم (feature) - providerPhone و providerWhatsapp
                        // - المستخدم: من جدول users - requester_phone و requester_whatsapp
                        const contactObj = {
                            phone: chatRole === 'user' ? (r.providerPhone || r.provider_phone || r.phone) : (r.requester_phone || r.user_phone || r.userPhone || r.phone),
                            whatsapp: chatRole === 'user' ? (r.providerWhatsapp || r.provider_whatsapp || r.providerPhone || r.phone) : (r.requester_whatsapp || r.user_whatsapp || r.userPhone || r.phone)
                        };
                        openChatModal(r.id, chatRole, otherPartyName, isCompleted, contactObj, r.service_type);
                    };
                    card.appendChild(chatBtn);

                    // إضافة زر كتابة التعليق للطلبات المكتملة التي تنقصها تعليق
                    if (isCompleted && isMyRequest) {
                        checkAndAddCommentButton(r.id, card, otherPartyName, r.service_type);
                        // إضافة زر التقييم للطلبات المكتملة التي لم يتم تقييمها
                        checkAndAddRatingButton(r.id, card, otherPartyName, r.service_type);
                    }
                }

                // [حل الثغرة الثانية] حظر تام لزر الإلغاء في القائمة إذا كانت الحالة مكتملة (isCompleted)
                if (!isCompleted && (isPending || isAccepted) && (isMyRequest || chatRole === 'provider')) {
                    const cancelBtn = document.createElement('button');
                    cancelBtn.innerHTML = '<i class="fas fa-ban"></i> إلغاء الطلب';
                    cancelBtn.style.cssText = 'background:#dc3545; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:12px; margin-top:4px; font-weight:bold;';
                    cancelBtn.onclick = async (event) => {
                    event.stopPropagation();
                    const reason = await promptDialog('يرجى كتابة سبب إلغاء الطلب:', '', { required: true });
                    if (reason === null) return;

                        try {
                            const cancelRes = await fetch(`${window.location.origin}/api/service-requests/${r.id}/cancel`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ user_id: userId, role: chatRole, cancellation_reason: reason })
                            });
                            const cancelData = await cancelRes.json();
                            if (cancelData.success) {
                                toast('✅ تم إلغاء الطلب بنجاح.', 'success');
                                modalWrapper.remove();
                                showActiveRequestsList();
                            } else {
                                toast('❌ ' + (cancelData.error || 'تعذر إلغاء الطلب.'), 'error');
                            }
                        } catch (err) {
                            toast('حدث خطأ أثناء الاتصال بالسيرفر.', 'error');
                        }
                    };
                    card.appendChild(cancelBtn);
                }

                container.appendChild(card);
            });

        } catch (err) {
            toast('تعذر جلب القائمة.', 'error');
        }
    }

    window.ServiceChat = window.ServiceChat || {};

    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.req-svc-btn');
        if (!btn) return;
        window.ServiceChat.requestService({
            providerName: btn.dataset.provider,
            serviceType: btn.dataset.service,
            serviceLayer: btn.dataset.layer,
            featureId: btn.dataset.featureId,
            whatsapp: btn.dataset.whatsapp,
            phone: btn.dataset.phone
        });
    });

    window.ServiceChat.requestService = async function (opts) {
        const userId = getCurrentUserId();
        if (!userId) {
            toast('يرجى تسجيل الدخول أولاً لطلب الخدمة.', 'warning');
            return;
        }

        // منع النقر المزدوج
        if (isRequestingService) {
            toast('جاري إرسال طلبك، يرجى الانتظار...', 'info');
            return;
        }

        isRequestingService = true;

        const providerName = opts.providerName || opts.provider || 'مزود الخدمة';
        const serviceType = opts.serviceType || opts.service || '';
        const serviceLayer = opts.serviceLayer || opts.layer || '';
        const featureId = opts.featureId || opts.feature || opts.featureid;

        if (!serviceLayer || !featureId) {
            toast('تعذر تحديد بيانات مزود الخدمة لهذا المعلم.', 'error');
            isRequestingService = false;
            return;
        }

        try {
            const checkRes = await fetch(`${window.location.origin}/api/service-requests?user_id=${userId}`);
            const checkData = await checkRes.json();
            if (checkData.success && checkData.requests) {
                const existing = checkData.requests.find(r => 
                    String(r.feature_id) === String(featureId) && 
                    r.service_layer === serviceLayer && 
                    ['pending', 'accepted'].includes(r.status)
                );
                if (existing) {
                    isRequestingService = false;
                    if (existing.status === 'accepted') {
                        const chatRole = String(existing.provider_user_id) === String(userId) ? 'provider' : 'user';
                        openChatModal(existing.id, chatRole, existing.provider_name || providerName, false, null, existing.service_type || serviceType);
                        return;
                    } else {
                        toast('⏳ لديك طلب معلق بالفعل لهذا المزود، بانتظار رده.', 'warning');
                        return;
                    }
                }
            }
        } catch (err) {
            isRequestingService = false;
        }

        const confirmed = await confirmDialog(`سيتم إرسال طلب خدمة إلى "${providerName}" (${serviceType})، وسيصلك إشعار فور رده. متابعة؟`, { okText: 'إرسال الطلب' });
        if (!confirmed) {
            isRequestingService = false;
            return;
        }

        try {
            const res = await fetch(window.location.origin + '/api/service-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    service_layer: serviceLayer,
                    feature_id: featureId,
                    provider_name: providerName,
                    service_type: serviceType
                })
            });
            const data = await res.json();
            if (data.success) {
                toast('✅ تم إرسال طلبك بنجاح. يمكنك متابعة حالة الطلب أو إلغاؤه من زر "طلباتي" في الملف الشخصي.', 'success');
                triggerPulseEffect(data.requestId);
            } else {
                toast('❌ ' + (data.error || 'تعذر إرسال الطلب.'), 'error');
            }
        } catch (err) {
            toast('حدث خطأ أثناء الاتصال بالسيرفر.', 'error');
        } finally {
            isRequestingService = false;
        }
    };

    function startPollingRequests() {
        if (pollRequestsInterval) clearInterval(pollRequestsInterval);

        const checkPendingForProvider = async () => {
            const userId = getCurrentUserId();
            if (!userId) return;
            if (typeof navigator.onLine === 'boolean' && !navigator.onLine) return;

            // إذا كان polling معطل، لا نفعل شيئاً
            const now = Date.now();
            if (now < pollingDisabledUntil) {
                return;
            }

            try {
                const resProvider = await fetch(`${window.location.origin}/api/service-requests?provider_user_id=${userId}&status=pending`);
                if (!resProvider.ok) return;
                
                const dataProvider = await resProvider.json();
                
                if (dataProvider.success && dataProvider.requests && dataProvider.requests.length > 0) {
                    const req = dataProvider.requests[0];
                    // فقط إذا لم يكن البانر معروضاً بالفعل والطلب لم يتم معالجته
                    if (incomingBanner && lastHandledPendingReqId !== req.id) {
                        showIncomingRequestBanner(req);
                        triggerPulseEffect(req.id);
                        // تشغيل الرنة من polling فقط إذا لم يكن socket متصل
                        playRequestRing();
                        lastHandledPendingReqId = req.id;
                    } else {
                    }
                }
            } catch (e) {}
        };

        checkPendingForProvider();
        pollRequestsInterval = setInterval(checkPendingForProvider, 3000);
    }

    function showIncomingRequestBanner(req) {
        
        buildUI();
        if (!incomingBanner) {
            return;
        }
        
        // تجنب عرض نفس الطلب مرتين
        if (handledRequests.has(req.id)) {
            return;
        }
        
        // إذا كان البانر معروضاً بالفعل، لا تعرضه مرة أخرى
        if (incomingBanner.style.display === 'block') {
            return;
        }
        
        // تنظيف الطلبات القديمة من Map (أكبر من دقيقة)
        const now = Date.now();
        for (const [reqId, timestamp] of handledRequests.entries()) {
            if (now - timestamp > 60000) {
                handledRequests.delete(reqId);
            }
        }
        
        // إضافة الطلب إلى Map
        handledRequests.set(req.id, now);
        lastHandledPendingReqId = req.id;
        lastRequestTimestamp = now;
        
        incomingBanner.innerHTML = `
            <div style="font-weight:bold; color:#1a73e8; margin-bottom:8px; font-size:14px;"><i class="fas fa-bell"></i> طلب خدمة جديد</div>
            <div style="font-size:13px; color:#333; margin-bottom:12px;">طلب (${req.service_type || 'خدمة'}). هل ترغب بقبوله؟</div>
            <div style="display:flex; gap:8px;">
                <button id="svc-accept-${req.id}" style="flex:1; background:#28a745; color:#fff; border:none; padding:9px; border-radius:8px; cursor:pointer; font-weight:bold;">قبول</button>
                <button id="svc-reject-${req.id}" style="flex:1; background:#dc3545; color:#fff; border:none; padding:9px; border-radius:8px; cursor:pointer; font-weight:bold;">رفض</button>
            </div>
        `;
        incomingBanner.style.display = 'block';

        const acceptBtn = document.getElementById(`svc-accept-${req.id}`);
        const rejectBtn = document.getElementById(`svc-reject-${req.id}`);
        if (acceptBtn) acceptBtn.onclick = () => respondToRequest(req.id, 'accept', req.service_type);
        if (rejectBtn) rejectBtn.onclick = () => respondToRequest(req.id, 'reject', req.service_type);
    }

    document.addEventListener('serviceRequestNew', (e) => {
        
        const requestId = e.detail.id || e.detail.requestId;
        if (!requestId) {
            return;
        }
        
        
        // منع التكرار: إذا تم معالجة هذا الطلب بالفعل، لا تفعل شيئاً
        if (lastHandledPendingReqId === requestId) {
            return;
        }
        
        buildUI();
        showIncomingRequestBanner({
            id: requestId,
            service_type: e.detail.serviceType
        });
        triggerPulseEffect(requestId);
        // تشغيل رنة 5 ثوانٍ لمزود الخدمة
        playRequestRing();
        
        // تعطيل polling لمدة 30 ثانية عند استقبال إشعار من socket
        pollingDisabledUntil = Date.now() + 30000;
        lastHandledPendingReqId = requestId;
    });

    async function respondToRequest(requestId, action, serviceType) {
        const userId = getCurrentUserId();
        try {
            const res = await fetch(`${window.location.origin}/api/service-requests/${requestId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider_user_id: userId, action })
            });
            const data = await res.json();
            if (incomingBanner) incomingBanner.style.display = 'none';

            removePulseEffect(requestId);
            // إيقاف الرنة عند الرد على الطلب
            stopRequestRing();

            if (data.success && action === 'accept') {
                // التأكد من بناء UI قبل فتح الدردشة
                buildUI();
                openChatModal(requestId, 'provider', 'المستخدم الطالب', false, null, serviceType);
            } else if (action === 'reject') {
                toast('تم رفض الطلب.', 'info');
            }
        } catch (err) {
            toast('تعذر إرسال الرد، حاول مجدداً.', 'error');
        }
    }

    document.addEventListener('serviceRequestResponse', (e) => {
        const data = e.detail;
        if (data.status === 'accepted') {
            toast('✅ وافق مزود الخدمة على طلبك! يتم الآن فتح الدردشة.', 'success');
            // التأكد من بناء UI قبل فتح الدردشة
            buildUI();
            openChatModal(data.requestId, 'user', data.providerName || 'مزود الخدمة', false, null, data.serviceType);
        } else if (data.status === 'rejected') {
            toast('❌ اعتذر مزود الخدمة عن طلبك.', 'error');
            removePulseEffect(data.requestId);
        }
    });

    async function loadMessages() {
        if (!currentOpenRequestId) return;
        try {
            const res = await fetch(`${window.location.origin}/api/service-requests/${currentOpenRequestId}/messages`);
            const data = await res.json();
            if (data.success) {
                renderMessages(data.messages);
                if (data.requestStatus === 'completed') {
                    // 🆕 استخدام البيانات الصحيحة:
                    // - مزود الخدمة: من المعلم (feature) - providerPhone و providerWhatsapp
                    // - المستخدم: من جدول users - userPhone و userWhatsapp
                    const contactObj = {
                        phone: currentUserRoleInChat === 'user' ? (data.providerPhone || data.provider_phone || data.phone) : (data.userPhone || data.user_phone || data.phone),
                        whatsapp: currentUserRoleInChat === 'user' ? (data.providerWhatsapp || data.provider_whatsapp || data.providerPhone || data.phone) : (data.userWhatsapp || data.user_whatsapp || data.userPhone || data.phone)
                    };
                    chatStatusLine.innerHTML = renderContactDetailsBox(contactObj, currentOtherPartyName, currentServiceTypeLabel);
                    chatConfirmBtn.disabled = true;
                    chatConfirmBtn.style.opacity = '0.6';
                    chatConfirmBtn.innerHTML = '<i class="fas fa-check-circle"></i> تم الاتفاق فعلياً (أرشيف)';
                    const inputArea = document.getElementById('service-chat-input-area');
                    if (inputArea) inputArea.style.display = 'none';
                    if (chatCancelBtn) chatCancelBtn.style.display = 'none'; // أمان إضافي أثناء التحديث الدوري للرسائل
                    
                    // فتح واجهة التقييم للمستخدم الطالب فقط
                    if (currentUserRoleInChat === 'user') {
                        // التحقق من عدم وجود واجهة تقييم مفتوحة بالفعل
                        const existingModal = document.getElementById('rating-modal');
                        if (!existingModal) {
                            // التحقق من عدم وجود تقييم سابق
                            const ratingRes = await fetch(`${window.location.origin}/api/service-requests/${currentOpenRequestId}/rating-check?user_id=${getCurrentUserId()}`);
                            const ratingData = await ratingRes.json();
                            if (!ratingData.hasRated) {
                                setTimeout(() => showRatingModal(currentOpenRequestId, currentOtherPartyName, currentServiceTypeLabel), 1000);
                            }
                        }
                    }
                }
            }
        } catch (err) {}
    }

    function renderMessages(messages) {
        if (!chatBody) return;
        const wasScrolledDown = (chatBody.scrollTop + chatBody.clientHeight) >= (chatBody.scrollHeight - 40);
        chatBody.innerHTML = '';
        if (messages.length === 0) {
            chatBody.innerHTML = '<div style="text-align:center; color:#999; font-size:12px;">لا توجد رسائل بعد. ابدأ المحادثة!</div>';
        }
        messages.forEach(m => {
            const isMine = m.sender_role === currentUserRoleInChat;
            const bubble = document.createElement('div');
            bubble.style.cssText = `
                max-width:75%; padding:9px 13px; border-radius:14px; font-size:13px; line-height:1.5; word-wrap:break-word;
                align-self: ${isMine ? 'flex-end' : 'flex-start'};
                background: ${isMine ? '#1a73e8' : '#fff'};
                color: ${isMine ? '#fff' : '#333'};
                border: ${isMine ? 'none' : '1px solid #ddd'};
            `;
            bubble.textContent = m.message;
            chatBody.appendChild(bubble);
        });
        if (wasScrolledDown) chatBody.scrollTop = chatBody.scrollHeight;
    }

    document.addEventListener('serviceRequestMessage', (e) => {
        if (e.detail.requestId === currentOpenRequestId) {
            loadMessages();
            // مسح التوهج فوراً إذا كانت المحادثة المعنية مفتوحة حالياً
            removePulseEffect(e.detail.requestId);
        } else {
            triggerPulseEffect(e.detail.requestId);
        }
    });

    async function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text || !currentOpenRequestId) return;
        const userId = getCurrentUserId();
        chatInput.value = '';
        try {
            await fetch(`${window.location.origin}/api/service-requests/${currentOpenRequestId}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender_role: currentUserRoleInChat, sender_id: userId, message: text })
            });
            loadMessages();
        } catch (err) {
            toast('تعذر إرسال الرسالة.', 'error');
        }
    }

    async function confirmAgreement() {
        if (!currentOpenRequestId) return;
        const userId = getCurrentUserId();
        const confirmed = await confirmDialog('هل أنت متأكد من إتمام الاتفاق؟ سيتم عرض وسائل التواصل (اتصال + واتساب) فور تأكيد الطرف الآخر.', { okText: 'نعم، تم الاتفاق' });
        if (!confirmed) return;

        try {
            const res = await fetch(`${window.location.origin}/api/service-requests/${currentOpenRequestId}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: currentUserRoleInChat, user_id: userId })
            });
            const data = await res.json();
            if (data.success) {
                if (data.status === 'completed') {
                    // 🆕 استخدام البيانات الصحيحة:
                    // - مزود الخدمة: من المعلم (feature) - providerPhone و providerWhatsapp
                    // - المستخدم: من جدول users - userPhone و userWhatsapp
                    const contactObj = {
                        phone: currentUserRoleInChat === 'user' ? (data.providerPhone || data.provider_phone || data.phone) : (data.userPhone || data.user_phone || data.phone),
                        whatsapp: currentUserRoleInChat === 'user' ? (data.providerWhatsapp || data.provider_whatsapp || data.providerPhone || data.phone) : (data.userWhatsapp || data.user_whatsapp || data.userPhone || data.phone)
                    };
                    chatStatusLine.innerHTML = renderContactDetailsBox(contactObj, currentOtherPartyName, currentServiceTypeLabel);
                    chatConfirmBtn.disabled = true;
                    chatConfirmBtn.style.opacity = '0.6';
                    chatConfirmBtn.innerHTML = '<i class="fas fa-check-circle"></i> تم الاتفاق فعلياً (أرشيف)';
                    const inputArea = document.getElementById('service-chat-input-area');
                    if (inputArea) inputArea.style.display = 'none';
                    if (chatCancelBtn) chatCancelBtn.style.display = 'none'; // إخفاء الإلغاء فور الاكتمال
                    toast('🎉 تم إتمام الاتفاق بنجاح وظهرت أرقام التواصل!', 'success');
                    removePulseEffect(currentOpenRequestId);
                    
                    // فتح واجهة التقييم بعد اكتمال الاتفاق - فقط للمستخدم الطالب
                    if (currentUserRoleInChat === 'user') {
                        setTimeout(() => showRatingModal(currentOpenRequestId, currentOtherPartyName, currentServiceTypeLabel), 1500);
                    }
                } else {
                    toast('✅ تم تسجيل تأكيدك بنجاح، بانتظار تأكيد الطرف الآخر لتفعيل أرقام التواصل.', 'success');
                    chatConfirmBtn.disabled = true;
                    chatConfirmBtn.style.opacity = '0.6';
                }
            } else {
                toast('❌ ' + (data.error || 'تعذر تأكيد الاتفاق.'), 'error');
            }
        } catch (err) {
            toast('حدث خطأ أثناء الاتصال بالسيرفر.', 'error');
        }
    }

    // ==========================================================================
    // واجهة التقييم والتعليق
    // ==========================================================================
    
    // دالة التحقق من وجود تعليق وإضافة زر كتابة التعليق
    async function checkAndAddCommentButton(requestId, card, providerName, serviceType) {
        try {
            const userId = getCurrentUserId();
            const res = await fetch(`${window.location.origin}/api/service-requests/${requestId}/rating-check?user_id=${userId}`);
            const data = await res.json();
            
            if (data.success && data.hasRated && !data.hasComment && data.ratingId) {
                const commentBtn = document.createElement('button');
                commentBtn.innerHTML = '<i class="fas fa-comment-dots"></i> كتابة تعليق';
                commentBtn.style.cssText = 'background:#ffc107; color:#333; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:12px; margin-top:4px; font-weight:bold;';
                commentBtn.onclick = () => showCommentModal(data.ratingId, providerName, serviceType);
                card.appendChild(commentBtn);
                
                // إضافة توهج للبطاقة التي تنقصها تعليق
                card.classList.add('svc-request-card-glow');
                card.style.background = '#fff9e6';
                card.style.borderColor = '#ffc107';
            }
        } catch (err) {
        }
    }

    // دالة التحقق من عدم وجود تقييم وإضافة زر التقييم
    async function checkAndAddRatingButton(requestId, card, providerName, serviceType) {
        try {
            const userId = getCurrentUserId();
            const res = await fetch(`${window.location.origin}/api/service-requests/${requestId}/rating-check?user_id=${userId}`);
            const data = await res.json();
            
            if (data.success && !data.hasRated) {
                const ratingBtn = document.createElement('button');
                ratingBtn.innerHTML = '<i class="fas fa-star"></i> قيّم الخدمة';
                ratingBtn.style.cssText = 'background:#1a73e8; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:12px; margin-top:4px; font-weight:bold;';
                ratingBtn.onclick = () => showRatingModal(requestId, providerName, serviceType);
                card.appendChild(ratingBtn);
                
                // إضافة توهج للبطاقة التي تنقصها تقييم
                card.classList.add('svc-request-card-glow');
                card.style.background = '#e3f2fd';
                card.style.borderColor = '#1a73e8';
            }
        } catch (err) {
        }
    }

    // دالة التحقق من وجود تعليقات معلقة أو تقييمات معلقة للمستخدم
    async function checkPendingComments() {
        try {
            const userId = getCurrentUserId();
            if (!userId) return;
            
            // التحقق من التقييمات التي تنقصها تعليق
            try {
                const commentsRes = await fetch(`${window.location.origin}/api/service-ratings/pending-comments?user_id=${userId}`);
                const commentsData = await commentsRes.json();
                
                // التحقق من الطلبات المكتملة التي لم يتم تقييمها
                const ratingsRes = await fetch(`${window.location.origin}/api/service-requests/pending-ratings?user_id=${userId}`);
                const ratingsData = await ratingsRes.json();
                
                const hasPendingComments = commentsData.success && commentsData.pendingComments.length > 0;
                const hasPendingRatings = ratingsData.success && ratingsData.pendingRatings.length > 0;
            
                if (hasPendingComments || hasPendingRatings) {
                    // تفعيل توهج زر طلباتي
                    const myRequestsBtn = document.getElementById('open-my-service-chats');
                    if (myRequestsBtn) {
                        myRequestsBtn.classList.add('svc-requests-glow');
                        myRequestsBtn.style.boxShadow = '0 0 15px #ffc107, 0 0 30px #ffc107';
                    }
                    
                    // تفعيل توهج أيقونة الملف الشخصي
                    const profileBadge = document.getElementById('user-top-badge-container');
                    if (profileBadge) {
                        profileBadge.style.boxShadow = '0 0 15px #ffc107, 0 0 30px #ffc107';
                        profileBadge.style.animation = 'pulse-glow 2s infinite';
                    }
                }
            } catch (err) {
            }
        } catch (err) {
        }
    }

    // دالة فتح واجهة كتابة التعليق
    function showCommentModal(ratingId, providerName, serviceType) {
        const existingModal = document.getElementById('comment-modal');
        if (existingModal) return;

        const modal = document.createElement('div');
        modal.id = 'comment-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999999;
            display: flex; align-items: center; justify-content: center; direction: rtl; padding: 15px;
        `;
        
        modal.dataset.protected = 'true';

        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 24px; max-width: 450px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 18px; color: #333;">✍️ كتابة تعليق</h3>
                    <button id="close-comment-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
                </div>

                <div style="margin-bottom: 20px;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #555;">كيف كانت تجربتك مع <strong>${providerName}</strong> في خدمة <strong>${serviceType}</strong>؟</p>
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">لقد قمت بتقييم الخدمة سابقاً، الآن يمكنك إضافة تعليقك.</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #333;">تعليقك:</p>
                    <textarea id="comment-text" rows="4" placeholder="اكتب تجربتك مع مزود الخدمة وكيف كان تعامله معك..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; font-family: inherit; resize: vertical; direction: rtl;"></textarea>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button id="submit-comment" style="flex: 1; background: #1a73e8; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px;">إرسال التعليق كامل</button>
                    <button id="cancel-comment" style="flex: 1; background: #f1f3f4; color: #444; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px;">إلغاء</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('close-comment-modal').onclick = () => modal.remove();
        document.getElementById('cancel-comment').onclick = () => modal.remove();

        document.getElementById('submit-comment').onclick = async () => {
            const comment = document.getElementById('comment-text').value.trim();
            if (!comment) {
                toast('يرجى كتابة تعليق', 'warning');
                return;
            }

            const userId = getCurrentUserId();

            try {
                const res = await fetch(`${window.location.origin}/api/service-ratings/${ratingId}/comment`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        comment: comment
                    })
                });

                const data = await res.json();
                if (data.success) {
                    toast('✅ تم إضافة تعليقك بنجاح! شكراً لمشاركتك.', 'success');
                    modal.remove();
                    // إعادة تحميل قائمة الطلبات والتحقق من التعليقات المعلقة
                    const modalWrapper = document.querySelector('.svc-active-req-modal-wrapper');
                    if (modalWrapper) {
                        modalWrapper.remove();
                        showActiveRequestsList();
                    }
                    checkPendingComments();
                } else {
                    toast('❌ ' + (data.error || 'تعذر إضافة التعليق.'), 'error');
                }
            } catch (err) {
                toast('حدث خطأ أثناء الاتصال بالسيرفر.', 'error');
            }
        };
    }

    function showRatingModal(requestId, providerName, serviceType) {
        const existingModal = document.getElementById('rating-modal');
        if (existingModal) return; // لا تزيل المودال الموجود، فقط عد

        const modal = document.createElement('div');
        modal.id = 'rating-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999999;
            display: flex; align-items: center; justify-content: center; direction: rtl; padding: 15px;
        `;
        
        // إضافة حماية ضد الإزالة غير المقصودة
        modal.dataset.protected = 'true';

        modal.innerHTML = `
            <div style="background: #fff; width: 100%; max-width: 420px; border-radius: 16px; padding: 25px; box-shadow: 0 15px 40px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 18px; color: #1a73e8;"><i class="fas fa-star"></i> قيّم الخدمة</h3>
                    <button id="close-rating-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">✕</button>
                </div>
                
                <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 13px; color: #1565c0; line-height: 1.5;">
                        <i class="fas fa-info-circle"></i> يُمكنك الآن التقييم أو بعد استلام الخدمة كاملة من مزود الخدمة وفق الاتفاق بينكما.
                    </p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #555;">كيف كانت تجربتك مع <strong>${providerName}</strong> في خدمة <strong>${serviceType}</strong>؟</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #333;">التقييم بالنجوم:</p>
                    <div id="star-rating" style="display: flex; gap: 8px; font-size: 32px; color: #ddd; cursor: pointer; direction: ltr;">
                        <span data-rating="1">★</span>
                        <span data-rating="2">★</span>
                        <span data-rating="3">★</span>
                        <span data-rating="4">★</span>
                        <span data-rating="5">★</span>
                    </div>
                    <p id="rating-text" style="margin-top: 8px; font-size: 13px; color: #666;">اختر عدد النجوم</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #333;">تعليقك (اختياري):</p>
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">يمكنك كتابة التعليق الآن أو تأجيله لاحقاً من صفحة "طلباتي"</p>
                    <textarea id="rating-comment" rows="3" placeholder="اكتب تجربتك مع مزود الخدمة وكيف كان تعامله معك... (اختياري)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; font-family: inherit; resize: vertical; direction: rtl;"></textarea>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button id="submit-rating" style="flex: 1; background: #1a73e8; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px;">إرسال التقييم</button>
                    <button id="skip-rating" style="flex: 1; background: #f1f3f4; color: #444; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px;">تأجيل التقييم / التعليق</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let selectedRating = 0;
        const stars = modal.querySelectorAll('#star-rating span');
        const ratingText = document.getElementById('rating-text');
        const ratingTexts = ['سيء جداً', 'سيء', 'متوسط', 'جيد', 'ممتاز'];

        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                selectedRating = index + 1;
                updateStars(selectedRating);
                ratingText.textContent = ratingTexts[selectedRating - 1];
            });

            star.addEventListener('mouseenter', () => {
                updateStars(index + 1);
            });

            star.addEventListener('mouseleave', () => {
                updateStars(selectedRating);
            });
        });

        function updateStars(rating) {
            stars.forEach((star, index) => {
                star.style.color = index < rating ? '#ffc107' : '#ddd';
            });
        }

        document.getElementById('close-rating-modal').onclick = () => modal.remove();
        document.getElementById('skip-rating').onclick = () => modal.remove();

        document.getElementById('submit-rating').onclick = async () => {
            if (selectedRating === 0) {
                toast('يرجى اختيار التقييم بالنجوم', 'warning');
                return;
            }

            const comment = document.getElementById('rating-comment').value.trim();
            // التعليق اختياري الآن
            const userId = getCurrentUserId();

            try {
                const res = await fetch(`${window.location.origin}/api/service-requests/${requestId}/rating`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        rating: selectedRating,
                        comment: comment || null
                    })
                });

                const data = await res.json();
                if (data.success) {
                    if (comment) {
                        toast('✅ تم إرسال تقييمك وتعليقك بنجاح! شكراً لمشاركتك.', 'success');
                    } else {
                        toast('✅ تم إرسال تقييمك بنجاح! يمكنك كتابة التعليق لاحقاً من صفحة "طلباتي".', 'success');
                    }
                    modal.remove();
                    // التحقق من التقييمات والتعليقات المعلقة
                    checkPendingComments();
                    // إعادة تحميل قائمة الطلبات إذا كانت مفتوحة
                    const modalWrapper = document.querySelector('.svc-active-req-modal-wrapper');
                    if (modalWrapper) {
                        modalWrapper.remove();
                        showActiveRequestsList();
                    }
                } else {
                    toast('❌ ' + (data.error || 'تعذر إرسال التقييم.'), 'error');
                }
            } catch (err) {
                toast('حدث خطأ أثناء الاتصال بالسيرفر.', 'error');
            }
        };
    }

    document.addEventListener('serviceRequestCompleted', (e) => {
        const data = e.detail;
        
        // دائماً إزالة التوهج عند إتمام الطلب، بغض النظر عن ما إذا كان مفتوحاً أم لا
        removePulseEffect(data.requestId);
        
        if (data.requestId === currentOpenRequestId && chatModal && chatModal.style.display === 'flex') {
            // 🆕 استخدام البيانات الصحيحة:
            // - مزود الخدمة: من المعلم (feature) - providerPhone و providerWhatsapp
            // - المستخدم: من جدول users - userPhone و userWhatsapp
            const contactObj = {
                phone: currentUserRoleInChat === 'user' ? (data.providerPhone || data.provider_phone || data.phone) : (data.userPhone || data.user_phone || data.phone),
                whatsapp: currentUserRoleInChat === 'user' ? (data.providerWhatsapp || data.provider_whatsapp || data.providerPhone || data.phone) : (data.userWhatsapp || data.user_whatsapp || data.userPhone || data.phone)
            };
            chatStatusLine.innerHTML = renderContactDetailsBox(contactObj, currentOtherPartyName, currentServiceTypeLabel);
            chatConfirmBtn.disabled = true;
            chatConfirmBtn.style.opacity = '0.6';
            chatConfirmBtn.innerHTML = '<i class="fas fa-check-circle"></i> تم الاتفاق فعلياً (أرشيف)';
            const inputArea = document.getElementById('service-chat-input-area');
            if (inputArea) inputArea.style.display = 'none';
            if (chatCancelBtn) chatCancelBtn.style.display = 'none';
        }
    });

    if (document.readyState !== 'loading') {
        buildUI();
        restoreGlowStateIfNeeded();
        startPollingRequests();
        checkPendingComments(); // التحقق من التعليقات المعلقة عند تحميل الصفحة
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            buildUI();
            restoreGlowStateIfNeeded();
            startPollingRequests();
            checkPendingComments(); // التحقق من التعليقات المعلقة عند تحميل الصفحة
        });
    }
})();

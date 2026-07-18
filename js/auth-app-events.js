/**
 * auth-app-events.js
 * يحتوي على منطق التشغيل، التعامل مع النماذج، والاتصال بالسيرفر
 */

// ==========================================
// ⚙️ نظام تغيير كلمة المرور المطور بنافذة منبثقة مخفية وآمنة
// ==========================================

// وضع بيئة التطوير
const DEBUG_MODE = false; // غيّرها إلى true فقط عندما تريد رؤية السجلات

if (!DEBUG_MODE) {
    console.log = function() {}; // تعطيل سجلات الكونسول
    console.error = function() {}; // تعطيل سجلات الأخطاء (اختياري)
}

window.changeUserPassword = function (e) {
    if (e) e.preventDefault();

    // 1. جلب بيانات المستخدم لمعرفة معرفه (ID)
    const savedUser = localStorage.getItem('map_user');
    if (!savedUser) {
        alert("يرجى تسجيل الدخول أولاً لتتمكن من تغيير كلمة المرور.");
        return;
    }
    
    let parsedUser;
    try {
        parsedUser = JSON.parse(savedUser);
    } catch(err) {
        alert("خطأ في قراءة بيانات المستخدم الحالي.");
        return;
    }
    
    const userId = parsedUser.user_id || parsedUser.id;

    // إزالة أي نافذة قديمة إن وجدت بالصفحة
    const oldModal = document.getElementById('custom-pwd-modal');
    if (oldModal) oldModal.remove();

    // 2. إنشاء عناصر النافذة المنبثقة ديناميكياً وتنسيقها
    const modal = document.createElement('div');
    modal.id = 'custom-pwd-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); z-index: 200000; display: flex;
        align-items: center; justify-content: center; font-family: system-ui, sans-serif;
        direction: rtl; padding: 15px; box-sizing: border-box;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: #fff; padding: 25px; border-radius: 12px; width: 100%; max-width: 400px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3); border: 1px solid #e0e0e0;
    `;

    content.innerHTML = `
        <h3 style="margin-top: 0; color: #2c3e50; font-size: 18px; border-bottom: 2px solid #34495e; padding-bottom: 10px;">
            <i class="fas fa-key"></i> تغيير كلمة المرور بأمان
        </h3>
        
        <div style="margin-top: 15px;">
            <label style="display:block; font-size: 13px; color: #555; margin-bottom: 5px; font-weight: bold;">كلمة المرور الحالية:</label>
            <input type="password" id="modal-curr-pwd" style="width:100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size: 14px; outline: none;" placeholder="••••••••">
        </div>

        <div style="margin-top: 15px;">
            <label style="display:block; font-size: 13px; color: #555; margin-bottom: 5px; font-weight: bold;">كلمة المرور الجديدة (6 خانات كحد أدنى):</label>
            <input type="password" id="modal-new-pwd" style="width:100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size: 14px; outline: none;" placeholder="••••••••">
        </div>

        <p style="margin: 15px 0 0 0; font-size: 12px; color: #7f8c8d; line-height: 1.5; background: #f9f9f9; padding: 8px; border-radius: 6px; border-right: 3px solid #3498db;">
            💡 <strong>تواجه مشكلة؟</strong> تواصل معنا مباشرة عبر <a href="https://www.facebook.com/MapServesPalestine" target="_blank" style="color: #2980b9; text-decoration: underline; font-weight: bold;">صفحتنا على الفيس بوك</a> لمساعدتك فوراً.
        </p>

        <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button id="modal-submit-btn" style="background: #27ae60; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px;">تحديث</button>
            <button id="modal-close-btn" style="background: #7f8c8d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px;">إلغاء</button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // 3. إدارة أحداث أزرار النافذة المخصصة
    document.getElementById('modal-close-btn').onclick = function() {
        modal.remove();
    };

    document.getElementById('modal-submit-btn').onclick = async function() {
        const currentPassword = document.getElementById('modal-curr-pwd').value;
        const newPassword = document.getElementById('modal-new-pwd').value;
        const submitBtn = document.getElementById('modal-submit-btn');

        if (!currentPassword.trim()) {
            alert("خطأ: لا يمكن ترك حقل كلمة المرور الحالية فارغاً.");
            return;
        }
        if (newPassword.trim().length < 6) {
            alert("خطأ: يجب أن تتكون كلمة المرور الجديدة من 6 خانات أو أكثر.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "جاري التعديل...";

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            });

            const resText = await response.text();
            let data;
            try {
                data = JSON.parse(resText);
            } catch(pErr) {
                throw new Error("استجابة غير متوقعة من خادم المنصة.");
            }

            if (response.ok && data.status === 'success') {
                alert("🎉 تم تغيير كلمة المرور بنجاح!");
                modal.remove(); // إغلاق النافذة عند النجاح
            } else {
                alert("❌ فشل التعديل: " + (data.error || data.message || "حدث خطأ غير متوقع"));
                submitBtn.disabled = false;
                submitBtn.innerText = "تحديث";
            }

        } catch (error) {
            console.error('❌ خطأ أثناء الاتصال بالسيرفر لتغيير كلمة المرور:', error);
            alert(error.message || 'حدث خطأ أثناء الاتصال بالسيرفر، يرجى المحاولة لاحقاً.');
            submitBtn.disabled = false;
            submitBtn.innerText = "تحديث";
        }
    };
};

// ==========================================
// 🆕 دالة موحّدة لمسح الجلسة المحفوظة محلياً بالكامل (تُستخدم عند اكتشاف
// أن الجلسة أصبحت غير صالحة: تسجيل خروج إجباري من الإدارة أو تعطيل الحساب)
// ==========================================
function clearSavedSessionCompletely() {
    localStorage.removeItem('map_user');
    sessionStorage.removeItem('map_user');
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
}

// ==========================================
// 🆕 التحقق من صلاحية الجلسة المحفوظة محلياً عبر السيرفر قبل السماح بالدخول
// التلقائي (autoboot). يسد ثغرة إمكانية الدخول بجلسة قديمة بعد أن يقوم
// المشرف بتسجيل خروج المستخدم إجبارياً وهو غير متصل بالإنترنت وقتها.
// ==========================================
function verifySavedSessionThenEnter(parsedUser) {
    const savedUserId = parsedUser.user_id || parsedUser.id;

    if (!savedUserId) {
        // لا يوجد معرف مستخدم صالح بالبيانات المحفوظة - لا يمكن التحقق، نمسحها ونعرض شاشة الدخول
        clearSavedSessionCompletely();
        window.location.reload();
        return;
    }

    fetch('/api/auth/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ user_id: savedUserId })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
        if (data && data.valid === false) {
            // 🚨 الجلسة أصبحت غير صالحة (تسجيل خروج إجباري أو تعطيل الحساب)
            clearSavedSessionCompletely();

            if (data.reason === 'force_logout') {
                alert('🚨 تم تسجيل خروجك من قبل الإدارة. يرجى التواصل مع الإدارة عبر صفحة الفيسبوك قبل محاولة الدخول مجدداً.');
            } else if (data.reason === 'inactive') {
                alert('⚠️ حسابك معطل حالياً. يرجى التواصل مع الإدارة عبر صفحة الفيسبوك.');
            } else if (data.reason === 'not_found') {
                alert('⚠️ لم يتم العثور على هذا الحساب، يرجى تسجيل الدخول من جديد.');
            }

            // إعادة تحميل الصفحة لعرض شاشة تسجيل الدخول الطبيعية بدل الدخول التلقائي
            window.location.reload();
            return;
        }

        // ✅ الجلسة سليمة → إتمام الدخول التلقائي كالمعتاد
        enterPlatform(parsedUser, true);
    })
    .catch(function (err) {
        // فشل الاتصال بالسيرفر لأي سبب (شبكة/عطل مؤقت) => Fail-open حتى لا نمنع
        // مستخدمين شرعيين من الدخول بسبب انقطاع مؤقت لا علاقة له بصلاحية الجلسة
        console.warn('تعذر التحقق من صلاحية الجلسة، سيتم الدخول مؤقتاً (Fail-open):', err.message);
        enterPlatform(parsedUser, true);
    });
}

document.addEventListener("DOMContentLoaded", function () {
    // جلب عناصر شاشة الترحيب والتسجيل
    const authOverlay = document.getElementById("auth-splash-overlay");
    const welcomeSection = document.getElementById("auth-welcome-section");
    const emailFormSection = document.getElementById("auth-email-form-section");
    const authLoginSection = document.getElementById("auth-login-form-section");

    const agreeCheckbox = document.getElementById("agree-to-terms");
    const likedCheckbox = document.getElementById("liked-fb-page");
    const buttonsGroup = document.getElementById("auth-buttons-group");
    const registerForm = document.getElementById("register-form");

    const btnGoToRegisterEmail = document.getElementById("btn-go-to-register-email");

    hideAllEditPanelsAndButtonsGlobally();

    const savedUser = localStorage.getItem('map_user');
    if (savedUser && authOverlay) {
        try {
            const parsedUser = JSON.parse(savedUser);

            // 🔒 [إصلاح الثغرة]: التحقق من صلاحية الجلسة عبر السيرفر قبل الدخول
            // التلقائي، بدلاً من استدعاء enterPlatform() مباشرة بلا أي تحقق.
            verifySavedSessionThenEnter(parsedUser);
            return; 
        } catch (e) {
            console.error("خطأ في قراءة بيانات الجلسة المخزنة:", e);
            localStorage.removeItem('map_user');
        }
    }

    if (!authOverlay || !agreeCheckbox || !likedCheckbox || !buttonsGroup) {
        console.warn("نظام الترحيب: بعض عناصر HTML الترحيبية غير متوفرة بعد في الـ DOM أو تم تعديلها.");
        return;
    }

    function validateWelcomeTerms() {
        if (agreeCheckbox.checked && likedCheckbox.checked) {
            buttonsGroup.classList.remove("auth-buttons-disabled");
            buttonsGroup.classList.add("auth-buttons-enabled");
        } else {
            buttonsGroup.classList.remove("auth-buttons-enabled");
            buttonsGroup.classList.add("auth-buttons-disabled");
        }
    }

    agreeCheckbox.addEventListener("change", validateWelcomeTerms);
    likedCheckbox.addEventListener("change", validateWelcomeTerms);

    if (btnGoToRegisterEmail) {
        btnGoToRegisterEmail.addEventListener("click", function(e) {
            e.preventDefault();
            if (buttonsGroup.classList.contains("auth-buttons-disabled")) {
                alert("يرجى الموافقة على الشروط أولاً وعمل لايك لصفحتنا المعتمدة.");
                return;
            }
            welcomeSection.classList.add("hidden");
            emailFormSection.classList.remove("hidden");
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async function (e) {
            e.preventDefault(); 

            const nameValue = document.getElementById("reg-name").value;
            const emailValue = document.getElementById("reg-email").value.trim().toLowerCase();
            const phoneValue = document.getElementById("reg-phone").value.trim();
            const passwordValue = document.getElementById("reg-password").value;

            const phoneRegex = /^05\d{8}$/;
            if (!phoneRegex.test(phoneValue)) {
                alert("خطأ: يجب أن يتكون رقم الجوال من 10 أرقام ويبدأ بـ 05 (مثال: 0599123456)");
                return;
            }

            const roleValue = "user"; 
            const submitButton = document.getElementById("btn-submit-register");
            if (submitButton) submitButton.disabled = true; 

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        name: nameValue,
                        email: emailValue,
                        phone: phoneValue,
                        password: passwordValue,
                        role: roleValue
                    })
                });

                const registerText = await response.text();
                let registerData;
                try {
                    registerData = JSON.parse(registerText);
                } catch (parseErr) {
                    throw new Error('استجابة غير صالحة من السيرفر أثناء التسجيل: ' + registerText);
                }

                if (!response.ok) {
                    throw new Error(registerData.error || registerData.message || 'فشلت عملية التسجيل');
                }

                if (registerData.status === 'success') {
                    const userConfirmed = confirm(
                        "🎉 تم تسجيل حسابك بنجاح!\n\n" +
                        "لتفعيل الحساب والتمكن من الدخول للمنصة، يرجى التواصل معنا عبر رسائل صفحتنا على الفيس بوك وإرسال الاسم الكامل ورقم جوالك.\n\n" +
                        "اضغط على (موافق) لفتح صفحة الفيس بوك ومراسلتنا الآن للتفعيل 👇"
                    );
                    
                    if (userConfirmed) {
                        window.open("https://www.facebook.com/MapServesPalestine", "_blank");
                    }

                    if (emailFormSection) emailFormSection.classList.add("hidden");
                    if (authLoginSection) authLoginSection.classList.remove("hidden");
                    
                    if (submitButton) {
                        submitButton.disabled = false;
                    }
                    return; 
                }

            } catch (error) {
                console.error('❌ خطأ في عملية التسجيل:', error);
                alert(error.message || 'حدث خطأ أثناء التسجيل، يرجى المحاولة لاحقاً.');
                if (submitButton) submitButton.disabled = false;
            }
        });
    }

    validateWelcomeTerms();

    const goToRegisterBtn = document.getElementById('go-to-register');
    if (goToRegisterBtn) {
        goToRegisterBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('auth-login-form-section').classList.add('hidden');
            document.getElementById('auth-email-form-section').classList.remove('hidden');
        });
    }

    const btnBackToLoginDirect = document.getElementById('btn-back-to-login-direct');
    if (btnBackToLoginDirect) {
        btnBackToLoginDirect.addEventListener('click', function() {
            document.getElementById('auth-email-form-section').classList.add('hidden');
            document.getElementById('auth-login-form-section').classList.remove('hidden');
        });
    }

    const btnLoginBackToWelcome = document.getElementById('btn-login-back-to-welcome');
    if (btnLoginBackToWelcome) {
        btnLoginBackToWelcome.addEventListener('click', function() {
            document.getElementById('auth-login-form-section').classList.add('hidden');
            document.getElementById('auth-welcome-section').classList.remove('hidden');
        });
    }

    const btnWelcomeBackToLogin = document.getElementById('btn-welcome-back-to-login');
    if (btnWelcomeBackToLogin) {
        btnWelcomeBackToLogin.addEventListener('click', function() {
            document.getElementById('auth-welcome-section').classList.add('hidden');
            document.getElementById('auth-login-form-section').classList.remove('hidden');
        });
    }

    const btnBackToWelcome = document.getElementById('btn-back-to-welcome');
    if (btnBackToWelcome) {
        btnBackToWelcome.addEventListener('click', function() {
            document.getElementById('auth-email-form-section').classList.add('hidden');
            document.getElementById('auth-welcome-section').classList.remove('hidden');
        });
    }

    const goToLoginBtn = document.getElementById('go-to-login');
    if (goToLoginBtn) {
        goToLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('auth-email-form-section').classList.add('hidden');
            document.getElementById('auth-login-form-section').classList.remove('hidden');
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('login-email').value.trim();
            const phone = document.getElementById('login-phone').value.trim();
            const password = document.getElementById('login-password').value;
            const submitBtn = document.getElementById('btn-submit-login');

            const phoneRegex = /^05\d{8}$/;
            if (!phoneRegex.test(phone)) {
                alert("صيغة رقم الجوال غير صحيحة، يجب أن يتكون من 10 أرقام ويبدأ بـ 05.");
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "جاري التحقق من البيانات...";
            }

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ email, phone, password })
                });

                const loginText = await response.text();
                let data;
                try {
                    data = JSON.parse(loginText);
                } catch (parseErr) {
                    throw new Error('استجابة غير متوقعة من السيرفر أثناء تسجيل الدخول: ' + loginText);
                }

                if (response.ok && data.user) {
                    alert(`مرحباً بك مجدداً: ${data.user.full_name}`);

                    let finalUserData = {
                        id: parseInt(data.user.user_id),
                        user_id: parseInt(data.user.user_id),
                        name: data.user.full_name,
                        full_name: data.user.full_name,
                        email: data.user.email,
                        phone: data.user.phone,
                        role: data.user.role,
                        service_layer: data.user.target_layer || null,
                        feature_id: data.user.target_id ? parseInt(data.user.target_id) : null,
                        targetLayer: data.user.target_layer || null,
                        targetId: data.user.target_id ? parseInt(data.user.target_id) : null
                    };

                    if (finalUserData.role === "admin") {
                        finalUserData.name = data.user.full_name + " (مشرف المنصة)";
                    } else if (finalUserData.role === "provider") {
                        finalUserData.name = data.user.full_name + " (مزود)";
                    }

                    enterPlatform(finalUserData, false);

                    if (window.notificationSystem && finalUserData.user_id) {
                        window.notificationSystem.init(finalUserData.user_id);
                        console.log('✅ تم تهيئة نظام الإشعارات للمستخدم:', finalUserData.user_id);
                    }

                } else {
                    alert(`خطأ في الدخول: ${data.message || data.error || 'بيانات الاعتماد غير صحيحة'}`);
                }
            } catch (error) {
                console.error('❌ خطأ في الاتصال بسيرفر التحقق:', error);
                alert(error.message || 'حدث خطأ أثناء الاتصال بالسيرفر، يرجى المحاولة لاحقاً.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = "دخول إلى المنصة";
                }
            }
        });
    }
});
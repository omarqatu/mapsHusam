/**
 * auth-app-events.js
 * يحتوي على منطق التشغيل، التعامل مع النماذج، والاتصال بالسيرفر
 */

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
    
    // الزر المضاف للانتقال للتسجيل
    const btnGoToRegisterEmail = document.getElementById("btn-go-to-register-email");

    // إخفاء فوري وتام لجميع لوحات وأزرار التحرير الخاصة بالمشرف عند بدء التشغيل لحين التحقق
    hideAllEditPanelsAndButtonsGlobally();

    // ==========================================
    // 🔥 فحص حالة تسجيل الدخول المستمر (جلسة المستخدم) عند فتح الصفحة
    // ==========================================
    const savedUser = localStorage.getItem('map_user');
    if (savedUser && authOverlay) {
        try {
            const parsedUser = JSON.parse(savedUser);
            
            // تمرير الكائن لعمل تفعيل فوري للمنصة وتخطي شاشة شاشة الحجب الرمادية
            enterPlatform(parsedUser, true); 
            return; 
        } catch (e) {
            console.error("خطأ في قراءة بيانات الجلسة المخزنة:", e);
            localStorage.removeItem('map_user');
        }
    }

    // فحص سلامة العناصر لمنع إيقاف الـ Script بالكامل في حال غياب أحد الديفات بالصفحة
    if (!authOverlay || !agreeCheckbox || !likedCheckbox || !buttonsGroup) {
        console.warn("نظام الترحيب: بعض عناصر HTML الترحيبية غير متوفرة بعد في الـ DOM أو تم تعديلها.");
        return;
    }

    // ==========================================
    // إدارة شروط تفعيل أزرار الترحيب الشاملة
    // ==========================================
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

    // تفعيل وظيفة الزر للانتقال للتسجيل
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

    // ==========================================
    // إرسال نموذج إنشاء حساب جديد مع التحقق من رقم الجوال
    // ==========================================
    if (registerForm) {
        registerForm.addEventListener("submit", function (e) {
            e.preventDefault(); 
            
            const nameValue = document.getElementById("reg-name").value;
            const emailValue = document.getElementById("reg-email").value.trim().toLowerCase();
            const phoneValue = document.getElementById("reg-phone").value.trim();
            const passwordValue = document.getElementById("reg-password").value;
            
            // تحقق صارم من رقم الجوال في الفرونت إند (10 أرقام تبدأ بـ 05)
            const phoneRegex = /^05\d{8}$/;
            if (!phoneRegex.test(phoneValue)) {
                alert("خطأ: يجب أن يتكون رقم الجوال من 10 أرقام ويبدأ بـ 05 (مثال: 0599123456)");
                return;
            }

            const roleValue = "user"; 

            const submitButton = document.getElementById("btn-submit-register");
            if (submitButton) submitButton.disabled = true; 

            fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nameValue,
                    email: emailValue,
                    phone: phoneValue,
                    password: passwordValue,
                    role: roleValue
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(err.error || 'فشلت عملية التسجيل'); });
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    // بناء كائن المستخدم الموحد عند التسجيل الجديد
                    let finalUserData = {
                        id: parseInt(data.user.user_id),
                        user_id: parseInt(data.user.user_id),
                        name: data.user.full_name,
                        full_name: data.user.full_name,
                        email: data.user.email,
                        phone: data.user.phone,
                        role: data.user.role,
                        service_layer: null,
                        feature_id: null,
                        targetLayer: null, 
                        targetId: null 
                    };

                    enterPlatform(finalUserData, false);
                }
            })
            .catch(error => {
                console.error('❌ خطأ في عملية التسجيل:', error);
                alert(error.message);
                if (submitButton) submitButton.disabled = false;
            });
        });
    }

    validateWelcomeTerms();

    // ==========================================
    // نظام التنقل الفوري والتبادلي للشاشات من شاشة الدخول الأساسية
    // ==========================================
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

    // ==========================================
    // إرسال نموذج تسجيل الدخول (Login) إلى السيرفر
    // ==========================================
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value.trim();
            const phone = document.getElementById('login-phone').value.trim();
            const password = document.getElementById('login-password').value;
            const submitBtn = document.getElementById('btn-submit-login');

            // فحص أولي لرقم الهاتف قبل إرساله إلى السيرفر
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, phone, password })
                });

                const data = await response.json();

                if (response.ok && data.user) {
                    alert(`مرحباً بك مجدداً: ${data.user.full_name}`);
                    
                    // بناء كائن بيانات موحد وشامل لتفادي الاختلافات البنيوية بين الملفات
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

                    // إضفاء طابع الرتب في التسمية والربط الافتراضي الآمن
                    if (finalUserData.role === "admin") {
                        finalUserData.name = data.user.full_name + " (مشرف المنصة)";
                    } else if (finalUserData.role === "provider") {
                        finalUserData.name = data.user.full_name + " (مزود)";
                    }

                    // تمرير الكائن للدالة الشاملة لإتمام الدخول والبث الخالي من الأخطاء
                    enterPlatform(finalUserData, false);

                } else {
                    alert(`خطأ في الدخول: ${data.message || 'بيانات الاعتماد غير صحيحة'}`);
                }
            } catch (error) {
                console.error('❌ خطأ في الاتصال بسيرفر التحقق:', error);
                alert('حدث خطأ أثناء الاتصال بالسيرفر، يرجى المحاولة لاحقاً.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = "دخول إلى المنصة";
                }
            }
        });
    }
});
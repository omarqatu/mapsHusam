/**
 * js/legal-content.js
 */
(function () {
    'use strict';

    // ==========================================================================
    // 1) المحتوى الموحّد - نقطة الحقيقة الوحيدة (Single Source of Truth)
    // ==========================================================================
    window.APP_LEGAL_CONTENT = {

        guide: {
            title: 'دليل استخدام المنصة',
            icon: 'fa-book-open',
            html: `
                <p style="font-size:14px; color:#555; line-height:1.8; margin-bottom:18px;">
                    مرحباً بك في <strong>خريطة الخدمات الفلسطينية</strong>. هذا الدليل الموحّد
                    يشرح كل أدوات المنصة سواء كنت تتصفح عبر الخريطة التفاعلية أو عبر صفحة
                    البحث بدون خريطة.
                </p>
                <div style="display:flex; flex-direction:column; gap:16px;">

                    <div style="background:#fff; border-right:5px solid #34a853; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#34a853; font-size:15px; display:block; margin-bottom:6px;">🔍 ١. البحث الذكي (خريطة وقائمة)</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">ابحث باسم الخدمة عبر شريط البحث أعلى الصفحة. استخدم زر "تحديث البيانات" لضمان ظهور أحدث النتائج، وبدّل بسهولة بين عرض "الخريطة" أو "البحث بدون خريطة" من خلال الروابط المتوفرة بأعلى كل صفحة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #fbbc04; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#e37400; font-size:15px; display:block; margin-bottom:6px;">📍 ٢. تحديد النطاق والمسافة</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">حدد موقعك بدقة أو استخدم الـ GPS، واضبط مسافة البحث بالمتر لتجد أقرب مزودي الخدمة المتاحين حالياً حولك بكل سهولة (متاح من داخل الخريطة التفاعلية).</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #ea4335; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#ea4335; font-size:15px; display:block; margin-bottom:6px;">📞 ٣. تواصل مباشر وسريع</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">اضغط على أي خدمة لتفتح نافذة معلوماتها، واستخدم أزرار "اتصال" أو "واتساب" للتحدث مباشرة مع المزود. للخدمات المرتبطة بحساب مزوّد مُفعّل، يظهر بدلاً منها زر "طلب الخدمة" الذي يفتح دردشة حقيقية داخل المنصة حتى الاتفاق وتبادل أرقام التواصل.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #7c3aed; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#7c3aed; font-size:15px; display:block; margin-bottom:6px;">📏 ٤. أدوات القياس ومشاركة الموقع</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">استفد من أدوات القياس لحساب المساحات والأطوال بدقة، وشارك مواقع الخدمات مع أصدقائك عبر رابط مباشر أو خرائط جوجل (متاح من داخل الخريطة التفاعلية).</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #1a73e8; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#1a73e8; font-size:15px; display:block; margin-bottom:6px;">📋 ٥. البحث بدون خريطة</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">بديل أخف وأسرع لمن لا يريد تحميل الخريطة: اختر الفرع والفئة، طبّق فلاتر اختيارية (المنطقة، السعر، الاسم...)، واحصل على نتائج فورية مع نفس أزرار التواصل وطلب الخدمة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #16a085; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#16a085; font-size:15px; display:block; margin-bottom:6px;">👤 ٦. الملف الشخصي</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">من أيقونة الملف الشخصي أعلى الصفحة يمكنك تغيير كلمة المرور، متابعة "طلباتي" (طلبات الخدمة والدردشات النشطة)، الاطلاع على الإشعارات، والوصول لدليل الاستخدام هذا وصفحة التواصل معنا في أي وقت.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #495057; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#495057; font-size:15px; display:block; margin-bottom:6px;">⚙️ ٧. تخصيص الخريطة</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">تحكم في نمط الخريطة (صورة فضائية، صورة جوية، أو خريطة أساس)، وأغلق لوحات البحث لتستمتع بعرض كامل ومريح للنتائج.</p>
                    </div>

                </div>

                <div style="background:#e8f0fe; border-radius:10px; padding:15px; margin-top:20px; text-align:center;">
                    <p style="margin:0; font-size:13px; color:#1a73e8;">
                        <i class="fas fa-video"></i> <strong>قريباً:</strong> فيديوهات تعليمية وصور توضيحية خطوة بخطوة
                    </p>
                </div>
            `
        },

        terms: {
            title: 'شروط الاستخدام وإخلاء المسؤولية',
            icon: 'fa-file-contract',
            html: `
                <ul style="padding-right:20px; margin:0; font-size:13.5px; color:#444; line-height:1.9;">
                    <li>المنصة عبارة عن وسيط جيو-رقمي يربط المستخدم بمزود الخدمة عبر الواتساب أو نظام طلب الخدمة الداخلي فقط.</li>
                    <li>الاتفاق على الأسعار، المواعيد، أو تفاصيل الخدمة يتم بين الطرفين مباشرة دون أي تدخل من إدارة المنصة.</li>
                    <li>المنصة تخلي مسؤوليتها بالكامل عن أي خلاف، سوء معاملة، أو إخلال بالاتفاق بين الأطراف.</li>
                    <li>في حال وجود شكاوى، يتم مراسلتنا عبر صفحة الفيسبوك لاتخاذ الإجراءات الإدارية اللازمة (كالحظر أو التعطيل).</li>
                    <li>يلتزم المستخدم بتقديم بيانات صحيحة عند التسجيل، وبعدم استخدام المنصة لأي غرض مخالف للقانون أو مضلل للمستخدمين الآخرين.</li>
                </ul>
            `
        },

        privacy: {
            title: 'سياسة الخصوصية وحماية البيانات',
            icon: 'fa-user-shield',
            html: `
                <p style="margin-bottom:12px; font-size:13.5px; color:#444; line-height:1.8;">نحن في منصة خريطة الخدمات الفلسطينية نولي اهتماماً بالغاً لخصوصية زوارنا ومستخدمينا، ونلتزم بما يلي:</p>
                <ul style="padding-right:20px; margin:0; font-size:13.5px; color:#444; line-height:1.9;">
                    <li><strong>البيانات الأساسية:</strong> نجمع فقط الاسم، البريد الإلكتروني، ورقم الجوال عند التسجيل، وتُستخدم حصراً لتشغيل حسابك والتحقق من هويتك.</li>
                    <li><strong>الموقع الجغرافي:</strong> تُستخدم إحداثيات الخريطة (GPS أو التحديد اليدوي) فقط لعرض الخدمات والعقارات القريبة بدقة، ولا تُخزَّن أو تُشارَك خارج نطاق تشغيل الخريطة.</li>
                    <li><strong>كلمة المرور:</strong> تُخزَّن كلمة المرور مشفّرة بالكامل، ولا يستطيع أي موظف بالمنصة الاطلاع عليها كنص صريح.</li>
                    <li><strong>أرقام التواصل:</strong> رقم الهاتف/الواتساب الخاص بك لا يظهر لمزود الخدمة إلا بعد أن تبدأ أنت التواصل معه (اتصال، واتساب، أو بعد إتمام الاتفاق عبر نظام طلب الخدمة).</li>
                    <li><strong>عدم البيع أو المشاركة:</strong> لا نبيع ولا نشارك بياناتك مع أي طرف ثالث لأغراض تسويقية.</li>
                    <li><strong>التخزين المحلي (Local Storage):</strong> يُستخدم فقط لحفظ جلسة الدخول وتفضيلات العرض على جهازك، ويمكنك مسحه في أي وقت من إعدادات المتصفح.</li>
                    <li><strong>طلب حذف الحساب أو البيانات:</strong> يمكنك التواصل معنا في أي وقت عبر صفحة الفيسبوك الرسمية لطلب حذف حسابك وبياناتك بالكامل.</li>
                </ul>
            `
        }
    };

    // ==========================================================================
    // 2) بناء مودال عام واحد (يُنشأ مرة واحدة فقط) لعرض أي من المحتويات أعلاه
    // ==========================================================================
    let modalOverlay, modalIcon, modalTitleEl, modalBodyEl;

    function ensureModal() {
        if (modalOverlay) return;

        modalOverlay = document.createElement('div');
        modalOverlay.id = 'app-legal-modal';
        modalOverlay.style.cssText = `
            display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6);
            align-items:center; justify-content:center;
            direction:rtl; padding:20px; box-sizing:border-box;
        `;
        // 🆕 [إصلاح مشكلة التداخل/الظهور خلف الشاشات الأخرى]: شاشتا الترحيب
        // الترويجية (#promo-splash-overlay) والتسجيل/الدخول (#auth-splash-overlay)
        // لهما z-index مرتفع جداً بملفات CSS الخاصة بهما (وأحياناً بأولوية
        // !important)، وهذا كان يجعل مودالنا يُرسَم تحتهما أو يتضارب معهما
        // بصرياً رغم أنه "يفتح" فعلياً بالـ DOM. نفرض هنا أعلى قيمة z-index
        // ممكنة بأولوية !important لضمان ظهوره دائماً فوق أي عنصر آخر بالصفحة
        // بلا استثناء، بغض النظر عن ترتيبه بالـ DOM أو ملفات CSS الأخرى.
        modalOverlay.style.setProperty('z-index', '2147483647', 'important');

        const box = document.createElement('div');
        box.style.cssText = `
            background:#fff; border-radius:16px; max-width:700px; width:100%;
            max-height:85vh; overflow-y:auto; padding:28px 26px; position:relative;
            box-shadow:0 10px 40px rgba(0,0,0,0.3);
        `;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'إغلاق');
        closeBtn.style.cssText = `
            position:absolute; top:12px; left:12px; background:#f0f0f0; border:none;
            border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:16px;
            display:flex; align-items:center; justify-content:center; color:#555;
        `;
        closeBtn.innerHTML = '✕';
        closeBtn.onclick = closeAppLegalModal;

        const titleWrap = document.createElement('h2');
        titleWrap.style.cssText = 'color:#1a73e8; font-size:21px; margin-top:0; margin-bottom:18px; border-bottom:2px solid #1a73e8; padding-bottom:10px; padding-left:36px;';
        modalIcon = document.createElement('i');
        modalIcon.className = 'fas';
        modalIcon.style.marginLeft = '8px';
        modalTitleEl = document.createElement('span');
        titleWrap.appendChild(modalIcon);
        titleWrap.appendChild(modalTitleEl);

        modalBodyEl = document.createElement('div');

        box.appendChild(closeBtn);
        box.appendChild(titleWrap);
        box.appendChild(modalBodyEl);
        modalOverlay.appendChild(box);
        document.body.appendChild(modalOverlay);

        modalOverlay.addEventListener('click', function (e) {
            if (e.target === modalOverlay) {
                e.stopPropagation();
                closeAppLegalModal();
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalOverlay.style.display === 'flex') closeAppLegalModal();
        });
    }

    let bodyOverflowBeforeOpen = '';

    window.openAppLegalModal = function (key) {
        const content = window.APP_LEGAL_CONTENT[key];
        if (!content) return;
        ensureModal();

        // 🆕 نعيد إلحاق المودال كآخر عنصر مباشرة داخل body في كل مرة يُفتح فيها،
        // كحماية إضافية تضمن تفوقه بترتيب الرسم حتى لو أُنشئت شاشات ترحيب/تسجيل
        // أخرى أو تعدّل ترتيب عناصر الصفحة بعد إنشاء المودال لأول مرة.
        if (modalOverlay.parentElement !== document.body || document.body.lastElementChild !== modalOverlay) {
            document.body.appendChild(modalOverlay);
        }

        modalIcon.className = 'fas ' + (content.icon || 'fa-info-circle');
        modalTitleEl.textContent = content.title;
        modalBodyEl.innerHTML = content.html;
        modalOverlay.style.display = 'flex';

        // منع سكرول الخلفية أثناء فتح المودال فوق شاشات الترحيب/التسجيل (تمنع
        // أي "قفز" بصري للمحتوى تحته يُشعر المستخدم بتضارب العناصر فوق بعضها)
        bodyOverflowBeforeOpen = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    };

    window.closeAppLegalModal = function () {
        if (modalOverlay) modalOverlay.style.display = 'none';
        document.body.style.overflow = bodyOverflowBeforeOpen;
    };

    // ==========================================================================
    // 3) الربط التلقائي: أي عنصر بالصفحة يحمل data-legal="guide|terms|privacy"،
    // بالإضافة لكل المعرّفات (IDs) الشائعة المستخدمة أصلاً بمختلف صفحات المنصة،
    // يُربط تلقائياً بدون أي كود إضافي مطلوب بالصفحة نفسها.
    // ==========================================================================
    const idMap = {
        guide: ['btn-user-guide', 'footer-guide-search', 'footer-guide-provider', 'welcome-guide-link'],
        terms: ['footer-terms-btn', 'promo-terms-link', 'welcome-terms-link'],
        privacy: ['footer-privacy-btn', 'promo-privacy-link', 'welcome-privacy-link']
    };

    function wireTriggers() {
        // عبر خاصية data-legal (الطريقة العامة الموصى بها لأي زر جديد مستقبلاً)
        document.querySelectorAll('[data-legal]').forEach(function (el) {
            if (el.dataset.legalWired) return;
            el.dataset.legalWired = '1';
            el.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                window.openAppLegalModal(el.getAttribute('data-legal'));
            });
        });

        // عبر المعرّفات (IDs) الشائعة للتوافق مع الأزرار الموجودة مسبقاً بالصفحات
        Object.keys(idMap).forEach(function (key) {
            idMap[key].forEach(function (id) {
                const el = document.getElementById(id);
                if (!el || el.dataset.legalWired) return;
                el.dataset.legalWired = '1';
                el.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.openAppLegalModal(key);
                });
            });
        });
    }

    if (document.readyState !== 'loading') {
        wireTriggers();
    } else {
        document.addEventListener('DOMContentLoaded', wireTriggers);
    }

    // إعادة فحص خفيفة لالتقاط أي أزرار تُضاف ديناميكياً لاحقاً (مثل نقل زر
    // "دليل الاستخدام" داخل بوابة الملف الشخصي عبر ui-collapse.js)
    window.refreshLegalTriggers = wireTriggers;
})();
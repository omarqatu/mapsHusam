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
            title: 'دليل استخدام منصة خريطة الخدمات الفلسطينية',
            icon: 'fa-book-open',
            html: `
                <p style="font-size:14px; color:#555; line-height:1.8; margin-bottom:18px;">
                    مرحباً بك في <strong>خريطة الخدمات الفلسطينية</strong>. هذا الدليل الموحّد يشرح كل أدوات المنصة سواء كنت تتصفح عبر الخريطة التفاعلية أو عبر صفحة البحث بدون خريطة.
                </p>

                <div style="background:#f0f7ff; border-radius:10px; padding:15px; margin-bottom:20px; border:1px solid #b3d7ff;">
                    <p style="margin:0; font-size:13px; color:#1a73e8; text-align:center;">
                        <i class="fas fa-info-circle"></i> <strong>المنصة توفر طريقتين للبحث:</strong> الخريطة التفاعلية (للبحث الجغرافي) والبحث السريع (للبحث السريع بدون خريطة)
                    </p>
                </div>

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

                    <div style="background:#fff; border-right:5px solid #e91e63; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#e91e63; font-size:15px; display:block; margin-bottom:6px;">🗺️ ٨. الخريطة التفاعلية - الأداة الجغرافية</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">الخريطة التفاعلية هي خريطة جغرافية ذكية تعرض جميع الخدمات والعقارات في فلسطين على خريطة حقيقية. يمكنك التكبير والتصغير، التحريك، والتفاعل مع المعالم مباشرة. استخدم "البحث الذكي" لإضافة شروط متعددة، و"الاستعلام" لاستكشاف الخدمات في منطقة معينة، و"ظهور/إخفاء الخدمات" للتحكم بـ 62 فئة مختلفة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #00bcd4; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#00bcd4; font-size:15px; display:block; margin-bottom:6px;">⚡ ٩. البحث السريع - الأداة السريعة</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">في صفحة البحث بدون خريطة، اكتب أي كلمة أو جملة دلالية في مربع البحث أعلى الصفحة (مثل: "شقة للإيجار"، "فني كهرباء") وستظهر النتائج فوراً. نفس الميزة متوفرة أيضاً في الخريطة التفاعلية. استخدم كلمات مفتاحية واضحة للحصول على نتائج أفضل.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #ff9800; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#ff9800; font-size:15px; display:block; margin-bottom:6px;">⭐ ١٠. التقييمات والتعليقات</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">يمكنك تقييم الخدمات التي استخدمتها وترك تعليقات. هذه التقييمات تساعد المستخدمين الآخرين في اختيار أفضل مزودي الخدمات وتساعد المزودين في تحسين خدماتهم.</p>
                    </div>

                </div>

                <div style="background:#e8f0fe; border-radius:10px; padding:15px; margin-top:20px; text-align:center;">
                    <p style="margin:0; font-size:13px; color:#1a73e8;">
                        <i class="fas fa-external-link-alt"></i> <strong>للانتقال إلى الخريطة التفاعلية:</strong>
                        <a href="/original-index.html" target="_blank" style="color:#1a73e8; text-decoration:underline; margin-right:8px;">اضغط هنا</a>
                        <span style="margin:0 10px;">|</span>
                        <i class="fas fa-list"></i> <strong>للانتقال إلى صفحة البحث السريع:</strong>
                        <a href="/no-map-search.html" target="_blank" style="color:#1a73e8; text-decoration:underline; margin-right:8px;">اضغط هنا</a>
                    </p>
                </div>

                <div style="background:#fff3cd; border-radius:10px; padding:15px; margin-top:15px; text-align:center;">
                    <p style="margin:0; font-size:13px; color:#856404;">
                        <i class="fas fa-video"></i> <strong>قريباً:</strong> فيديوهات تعليمية وصور توضيحية خطوة بخطوة
                    </p>
                </div>
            `
        },

        guideSearch: {
            title: 'البحث السريع',
            icon: 'fa-search',
            html: `
                <p style="font-size:14px; color:#555; line-height:1.8; margin-bottom:18px;">
                    البحث السريع هو أسرع وأسهل طريقة للعثور على الخدمات والعقارات التي تحتاجها دون الحاجة لفتح الخريطة التفاعلية.
                </p>
                <div style="display:flex; flex-direction:column; gap:16px;">

                    <div style="background:#fff; border-right:5px solid #34a853; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#34a853; font-size:15px; display:block; margin-bottom:6px;">🔍 كيفية البحث السريع</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">في صفحة البحث بدون خريطة، ستجد مربع بحث في أعلى الصفحة. اكتب أي كلمة أو جملة دلالية عن الخدمة أو العقار الذي تريده، مثل: "شقة للإيجار"، "فني كهرباء"، "طبيب"، "مطعم"، إلخ.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #fbbc04; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#e37400; font-size:15px; display:block; margin-bottom:6px;">📋 ظهور النتائج</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">بمجرد كتابة الكلمات والضغط على زر البحث، ستظهر لك جميع النتائج التي تطابق كلمات البحث. النتائج تتضمن تفاصيل كاملة مع أزرار للتواصل المباشر.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #ea4335; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#ea4335; font-size:15px; display:block; margin-bottom:6px;">🗺️ البحث السريع في الخريطة</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">نفس ميزة البحث السريع متوفرة أيضاً في الخريطة التفاعلية. ستجد مربع بحث في أعلى الخريطة يمكنك استخدامه للبحث عن أي خدمة أو عقار بسرعة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #7c3aed; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#7c3aed; font-size:15px; display:block; margin-bottom:6px;">� نصائح للبحث</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">استخدم كلمات مفتاحية واضحة ومحددة للحصول على نتائج أفضل. يمكنك أيضاً استخدام الفلاتر المتاحة لتضييق النتائج حسب المنطقة، السعر، أو أي تفاصيل أخرى.</p>
                    </div>

                    <div style="background:#e8f0fe; border-radius:10px; padding:15px; margin-top:20px; text-align:center;">
                        <p style="margin:0; font-size:13px; color:#1a73e8;">
                            <i class="fas fa-external-link-alt"></i> <strong>للانتقال إلى صفحة البحث السريع:</strong>
                            <a href="/no-map-search.html" target="_blank" style="color:#1a73e8; text-decoration:underline; margin-right:8px;">اضغط هنا</a>
                        </p>
                    </div>

                </div>
            `
        },

        guideProvider: {
            title: 'حساب مزود الخدمة',
            icon: 'fa-user-tie',
            html: `
                <p style="font-size:14px; color:#555; line-height:1.8; margin-bottom:18px;">
                    تعرف على مزايا حساب مزود الخدمة وكيفية الاستفادة من جميع الميزات المتاحة.
                </p>
                <div style="display:flex; flex-direction:column; gap:16px;">

                    <div style="background:#fff; border-right:5px solid #34a853; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#34a853; font-size:15px; display:block; margin-bottom:6px;">🔄 التحويل إلى مزود خدمة</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">تواصل معنا عبر صفحة الفيسبوك وفريق الدعم الفني لتحويل اشتراكك إلى مزود خدمة. يمكنك ربط خدمتك بحيث تقدر تعمل متوفر وغير متوفر لتظهر على الخريطة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #fbbc04; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#e37400; font-size:15px; display:block; margin-bottom:6px;">💬 خاصية الدردشة</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">بمجرد تفعيل حساب مزود الخدمة، يمكنك تفعيل خاصية الدردشة بحيث يتواصل معك أي مستخدم يريد الخدمة منك. ستتمكنون من التحدث والاتفاق على التفاصيل مباشرة عبر المنصة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #ea4335; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#ea4335; font-size:15px; display:block; margin-bottom:6px;">🟢 التحكم في الحالة</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">يمكنك التبديل بين "متوفر" و"غير متوفر" في أي وقت. عندما تكون متوفر، سيظهر موقعك على الخريطة ويمكن للمستخدمين التواصل معك مباشرة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #7c3aed; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#7c3aed; font-size:15px; display:block; margin-bottom:6px;">⭐ التقييمات والتعليقات</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">يمكن للمستخدمين تقييم خدماتك وترك تعليقات. هذه التقييمات تساعدك في بناء سمعة جيدة وجذب المزيد من العملاء.</p>
                    </div>

                    <div style="background:#e8f0fe; border-radius:10px; padding:15px; margin-top:20px; text-align:center;">
                        <p style="margin:0; font-size:13px; color:#1a73e8;">
                            <i class="fab fa-facebook-f"></i> <strong>للتحويل إلى مزود خدمة:</strong> تواصل معنا عبر صفحة الفيسبوك
                            <a href="https://www.facebook.com/MapServesPalestine" target="_blank" style="color:#1a73e8; text-decoration:underline;">MapServesPalestine</a>
                        </p>
                    </div>

                </div>
            `
        },

        guideSubscription: {
            title: 'كيف تشترك معنا',
            icon: 'fa-user-plus',
            html: `
                <p style="font-size:14px; color:#555; line-height:1.8; margin-bottom:18px;">
                    تعرف على كيفية الاشتراك في المنصة والاستفادة من جميع الخدمات المتاحة.
                </p>
                <div style="display:flex; flex-direction:column; gap:16px;">

                    <div style="background:#fff; border-right:5px solid #34a853; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#34a853; font-size:15px; display:block; margin-bottom:6px;">👤 التسجيل كمستخدم عادي</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">عندما تسجل معنا، تحصل على حساب مستخدم عادي يمكنك من خلاله البحث عن الخدمات، التواصل مع مزودي الخدمة، وتقييم الخدمات التي استخدمتها.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #fbbc04; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#e37400; font-size:15px; display:block; margin-bottom:6px;">🔄 التحويل إلى مزود خدمة</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">يمكنك تحويل حسابك من مستخدم عادي إلى مزود خدمة. هذا يتيح لك إضافة خدماتك إلى الخريطة، التحكم في حالتك (متوفر/غير متوفر)، والتواصل مع العملاء عبر الدردشة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #ea4335; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#ea4335; font-size:15px; display:block; margin-bottom:6px;">📞 التواصل معنا</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">لأي استفسار حول التسجيل أو التحويل إلى مزود خدمة، تواصل معنا عبر صفحة الفيسبوك الرسمية. فريق الدعم الفني سيجيب على جميع استفساراتك.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #7c3aed; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#7c3aed; font-size:15px; display:block; margin-bottom:6px;">🎯 المزايا</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">بصفتك مزود خدمة، ستحصل على: ظهور على الخريطة التفاعلية، إمكانية التحكم في حالتك، نظام دردشة للتواصل مع العملاء، وتقييمات من المستخدمين.</p>
                    </div>

                    <div style="background:#e8f0fe; border-radius:10px; padding:15px; margin-top:20px; text-align:center;">
                        <p style="margin:0; font-size:13px; color:#1a73e8;">
                            <i class="fab fa-facebook-f"></i> <strong>للاستفسار والتسجيل:</strong> تواصل معنا عبر صفحة الفيسبوك
                            <a href="https://www.facebook.com/MapServesPalestine" target="_blank" style="color:#1a73e8; text-decoration:underline;">MapServesPalestine</a>
                        </p>
                    </div>

                </div>
            `
        },

        guideMapInteractive: {
            title: 'الخريطة التفاعلية',
            icon: 'fa-map-marked-alt',
            html: `
                <p style="font-size:14px; color:#555; line-height:1.8; margin-bottom:18px;">
                    الخريطة التفاعلية هي الأداة الرئيسية للبحث عن الخدمات والعقارات في فلسطين بدقة عالية باستخدام تقنية الخرائط الجغرافية.
                </p>
                <div style="display:flex; flex-direction:column; gap:16px;">

                    <div style="background:#fff; border-right:5px solid #34a853; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#34a853; font-size:15px; display:block; margin-bottom:6px;">🗺️ ما هي الخريطة التفاعلية؟</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">الخريطة التفاعلية هي خريطة جغرافية ذكية تعرض جميع الخدمات والعقارات في فلسطين على خريطة حقيقية. يمكنك التكبير والتصغير، التحريك، والتفاعل مع المعالم مباشرة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #fbbc04; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#e37400; font-size:15px; display:block; margin-bottom:6px;">🔍 البحث الذكي</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">استخدم زر "البحث الذكي" لإضافة شروط متعددة للبحث. اختر الطبقة، الحقل، والشرط، ثم أضف أكثر من شرط دفعة واحدة للحصول على نتائج دقيقة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #ea4335; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#ea4335; font-size:15px; display:block; margin-bottom:6px;">ℹ️ الاستعلام</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">فعّل خيار "استعلام" ثم مرر أو انقر على أي معلم بالخريطة لتظهر لك تفاصيله فوراً. هذه الميزة مفيدة لاستكشاف الخدمات المتاحة في منطقة معينة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #7c3aed; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#7c3aed; font-size:15px; display:block; margin-bottom:6px;">📍 البحث حسب الموقع</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">حدد موقعك بدقة أو استخدم الـ GPS، واضبط مسافة البحث بالمتر لتجد أقرب الخدمات المتاحة حولك. هذه الميزة مثالية للخدمات العاجلة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #1a73e8; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#1a73e8; font-size:15px; display:block; margin-bottom:6px;">📚 ظهور/إخفاء الخدمات</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">استخدم زر "ظهور/إخفاء الخدمات" للتحكم بالطبقات التي تظهر لك على الخريطة. يمكنك اختيار من أصل 62 فئة مختلفة حسب احتياجاتك.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #16a085; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#16a085; font-size:15px; display:block; margin-bottom:6px;">📏 أدوات القياس</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">استخدم أدوات القياس لحساب المسافات، المساحات، أو رسم نقطة بإحداثيات دقيقة. هذه الميزات مفيدة للمهندسين والمساحين.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #495057; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#495057; font-size:15px; display:block; margin-bottom:6px;">🔗 مشاركة الموقع</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">حدد أي نقطة على الخريطة واحصل على رابط مباشر لها بإحداثيات فلسطينية وعالمية. يمكنك مشاركة هذا الرابط مع أصدقائك أو استخدامه للتنقل.</p>
                    </div>

                    <div style="background:#e8f0fe; border-radius:10px; padding:15px; margin-top:20px; text-align:center;">
                        <p style="margin:0; font-size:13px; color:#1a73e8;">
                            <i class="fas fa-external-link-alt"></i> <strong>للانتقال إلى الخريطة التفاعلية:</strong>
                            <a href="/original-index.html" target="_blank" style="color:#1a73e8; text-decoration:underline; margin-right:8px;">اضغط هنا</a>
                        </p>
                    </div>

                </div>
            `
        },

        guideMap: {
            title: 'دليل استخدام منصة خريطة الخدمات الفلسطينية',
            icon: 'fa-book-open',
            html: `
                <p style="font-size:14px; color:#555; line-height:1.8; margin-bottom:18px;">
                    مرحباً بك في <strong>خريطة الخدمات الفلسطينية</strong>. هذا الدليل الموحّد يشرح كل أدوات المنصة سواء كنت تتصفح عبر الخريطة التفاعلية أو عبر صفحة البحث بدون خريطة.
                </p>

                <div style="background:#f0f7ff; border-radius:10px; padding:15px; margin-bottom:20px; border:1px solid #b3d7ff;">
                    <p style="margin:0; font-size:13px; color:#1a73e8; text-align:center;">
                        <i class="fas fa-info-circle"></i> <strong>المنصة توفر طريقتين للبحث:</strong> الخريطة التفاعلية (للبحث الجغرافي) والبحث السريع (للبحث السريع بدون خريطة)
                    </p>
                </div>

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

                    <div style="background:#fff; border-right:5px solid #e91e63; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#e91e63; font-size:15px; display:block; margin-bottom:6px;">🗺️ ٨. الخريطة التفاعلية - الأداة الجغرافية</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">الخريطة التفاعلية هي خريطة جغرافية ذكية تعرض جميع الخدمات والعقارات في فلسطين على خريطة حقيقية. يمكنك التكبير والتصغير، التحريك، والتفاعل مع المعالم مباشرة. استخدم "البحث الذكي" لإضافة شروط متعددة، و"الاستعلام" لاستكشاف الخدمات في منطقة معينة، و"ظهور/إخفاء الخدمات" للتحكم بـ 62 فئة مختلفة.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #00bcd4; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#00bcd4; font-size:15px; display:block; margin-bottom:6px;">⚡ ٩. البحث السريع - الأداة السريعة</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">في صفحة البحث بدون خريطة، اكتب أي كلمة أو جملة دلالية في مربع البحث أعلى الصفحة (مثل: "شقة للإيجار"، "فني كهرباء") وستظهر النتائج فوراً. نفس الميزة متوفرة أيضاً في الخريطة التفاعلية. استخدم كلمات مفتاحية واضحة للحصول على نتائج أفضل.</p>
                    </div>

                    <div style="background:#fff; border-right:5px solid #ff9800; padding:16px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.06);">
                        <strong style="color:#ff9800; font-size:15px; display:block; margin-bottom:6px;">⭐ ١٠. التقييمات والتعليقات</strong>
                        <p style="margin:0; font-size:13.5px; color:#555; line-height:1.7;">يمكنك تقييم الخدمات التي استخدمتها وترك تعليقات. هذه التقييمات تساعد المستخدمين الآخرين في اختيار أفضل مزودي الخدمات وتساعد المزودين في تحسين خدماتهم.</p>
                    </div>

                </div>

                <div style="background:#e8f0fe; border-radius:10px; padding:15px; margin-top:20px; text-align:center;">
                    <p style="margin:0; font-size:13px; color:#1a73e8;">
                        <i class="fas fa-external-link-alt"></i> <strong>للانتقال إلى الخريطة التفاعلية:</strong>
                        <a href="/original-index.html" target="_blank" style="color:#1a73e8; text-decoration:underline; margin-right:8px;">اضغط هنا</a>
                        <span style="margin:0 10px;">|</span>
                        <i class="fas fa-list"></i> <strong>للانتقال إلى صفحة البحث السريع:</strong>
                        <a href="/no-map-search.html" target="_blank" style="color:#1a73e8; text-decoration:underline; margin-right:8px;">اضغط هنا</a>
                    </p>
                </div>

                <div style="background:#fff3cd; border-radius:10px; padding:15px; margin-top:15px; text-align:center;">
                    <p style="margin:0; font-size:13px; color:#856404;">
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
        guide: ['btn-user-guide', 'welcome-guide-link'],
        guideSearch: ['footer-guide-search'],
        guideProvider: ['footer-guide-provider'],
        guideSubscription: ['footer-guide-subscription'],
        guideMap: ['footer-guide-map'],
        guideMapInteractive: ['footer-guide-map-interactive'],
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
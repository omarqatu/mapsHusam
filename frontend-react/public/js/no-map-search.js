/**
 * js/no-map-search.js
 */

window.__nmsPageHandlesOwnAds = true;

(function () {
    
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        ['header-guide-search-services', 'footer-guide-search-services'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById('nms-categories-view') || document.getElementById('market-search-input');
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.getElementById('market-search-input')?.focus();
        });
    }
});

        const baseUrl = window.location.origin + '/';

        // 🆕 ربط زرّي "حالة الطرق" و"حالة محطات الوقود" بجانب زر "الخريطة التفاعلية"
        // بفتح نفس بوابة التحديثات الفورية المستخدمة بصفحة الخريطة، مباشرة عند البطاقة
        // المطلوبة (window.openWidgetsPortalToCard متوفرة بعد تحميل widgets-ticker.js
        // الموجود أصلاً بأسفل هذه الصفحة، ونفس التصميم المتجاوب لباقي الأزرار المجاورة
        // فلا يوجد أي تعارض إضافي بين عرض الكمبيوتر والموبايل/التابلت)
        (function bindRoadFuelStatusButtons() {
            const roadBtn = document.getElementById('nms-btn-road-status');
            const fuelBtn = document.getElementById('nms-btn-fuel-status');
            if (roadBtn) {
                roadBtn.addEventListener('click', () => {
                    if (typeof window.openWidgetsPortalToCard === 'function') {
                        window.openWidgetsPortalToCard('portal-road-status-card');
                    }
                });
            }
            if (fuelBtn) {
                fuelBtn.addEventListener('click', () => {
                    if (typeof window.openWidgetsPortalToCard === 'function') {
                        window.openWidgetsPortalToCard('portal-fuel-status-card');
                    }
                });
            }
        })();

        // ==========================================================================
        // 🆕 مساعدات مشتركة: هوية المستخدم الحالي + فحص حد الطلبات، أصبحتا معرّفتين
        // مرة واحدة فقط بملف shared-utils.js (window.getRealUserId و
        // window.checkRequestQuotaOrAlert) بدل تكرارهما هنا. يجب تحميل
        // shared-utils.js قبل هذا الملف في الصفحة.
        // ==========================================================================
        const getRealUserId = window.getRealUserId;
        const checkRequestQuotaOrAlert = window.checkRequestQuotaOrAlert;

        // ==========================================================================
        // 🆕 توحيد الملف الشخصي مع صفحة الخريطة: هذه الصفحة لا تحتوي على
        // #auth-splash-overlay ولا خريطة لتهيئتها، لذلك لم تكن enterPlatform()
        // (بملف auth-core-functions.js) تُستدعى هنا إطلاقاً - وبالتالي كان شريط
        // الملف الشخصي (#user-top-badge-container) يبقى فارغاً بلا اسم/رتبة حقيقية
        // ("---")، ولا تُفعَّل الإشعارات، ولا يظهر زر "لوحة التحكم" للمشرف، بعكس
        // صفحة الخريطة تماماً. هذا الجزء يكرر فقط الأجزاء غير المرتبطة بالخريطة
        // من enterPlatform() ليصبح الملف الشخصي مطابقاً تماماً لما يظهر بصفحة الخريطة.
        // ==========================================================================
        (function initTopUserBadgeForNoMapPage() {
            const authenticatedUser = window.__nmsAuthenticatedUser;
            if (!authenticatedUser) return;

            window.currentAppUser = authenticatedUser;

            // showTopUserBadge معرّفة عالمياً بملف auth-core-functions.js (يُحمَّل
            // قبل هذا الملف بالصفحة) - تملأ الاسم والرتبة وتُظهر زر لوحة التحكم للمشرف
            if (typeof showTopUserBadge === 'function') {
                showTopUserBadge(authenticatedUser);
            }

            const userId = authenticatedUser.user_id || authenticatedUser.id;
            if (window.notificationSystem && userId) {
                window.notificationSystem.init(userId);
            }

            const notificationBtn = document.getElementById('notification-toggle-btn');
            if (notificationBtn) notificationBtn.style.display = 'flex';

            // نفس الحدث الذي تُطلقه enterPlatform() بعد الدخول الفعلي بصفحة الخريطة،
            // ليبقى سلوك بقية الملفات (مثل ui-collapse.js وبوابة الملف الشخصي) متطابقاً
            document.dispatchEvent(new CustomEvent('userLoggedIn', { detail: authenticatedUser }));
        })();

        // ==========================================================================
        // 0-أ) مودال "من نحن"
        // ==========================================================================
        (function initAboutModal() {
            const aboutBtn = document.getElementById('nms-about-btn');
            const aboutModal = document.getElementById('nms-about-modal');
            const aboutClose = document.getElementById('nms-about-close');
            if (!aboutBtn || !aboutModal || !aboutClose) return;

            const openModal = () => aboutModal.classList.remove('hidden');
            const closeModal = () => aboutModal.classList.add('hidden');

            aboutBtn.addEventListener('click', openModal);
            aboutClose.addEventListener('click', closeModal);
            aboutModal.addEventListener('click', (e) => {
                if (e.target === aboutModal) closeModal(); // إغلاق عند النقر خارج الصندوق
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !aboutModal.classList.contains('hidden')) closeModal();
            });
        })();

        // ==========================================================================
        // 0) خلفية بصرية هادئة لقسم "كيف تبحث؟" - سلايدشو بطيء جداً من صور المنصة
        //    (نفس مجلد pic المستخدم في شاشة الترحيب الترويجية)، بشفافية خفيفة
        //    وتحوّل ناعم كل عدة ثوانٍ. يحترم تفضيل تقليل الحركة لدى المستخدم.
        // ==========================================================================
        (function initHeroSlideshow() {
            const slideshow = document.getElementById('nms-hero-slideshow');
            if (!slideshow) return;

            const images = [
                '/pic/Picture2.jpg', '/pic/Picture5.jpg', '/pic/Picture8.jpg',
                '/pic/Picture11.jpg', '/pic/Picture14.jpg', '/pic/غلاف1.png'
            ];

            images.forEach((src, index) => {
                const img = document.createElement('img');
                img.className = 'nms-hero-slide' + (index === 0 ? ' active' : '');
                img.src = src;
                img.alt = '';
                img.loading = index === 0 ? 'eager' : 'lazy';
                slideshow.appendChild(img);
            });

            const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (prefersReducedMotion || images.length < 2) return; // صورة ثابتة فقط، بدون تبديل

            let current = 0;
            setInterval(() => {
                const slides = slideshow.querySelectorAll('.nms-hero-slide');
                if (!slides.length) return;
                slides[current].classList.remove('active');
                current = (current + 1) % slides.length;
                slides[current].classList.add('active');
            }, 7000); // بطيء وهادئ - كل 7 ثواني
        })();

        // ==========================================================================
        // 1) بيانات الفئات (62 فئة: 3 عقارات + 59 خدمة)
        // ==========================================================================
        const iconMap = {
            'rentLayer': 'fa-home', 'saleLayer': 'fa-key', 'landLayer': 'fa-map',
            'fuel_stations': 'fa-gas-pump', 'road_barriers': 'fa-signs-post',
            'electrician': 'fa-bolt', 'ac_technician': 'fa-snowflake', 'plumber': 'fa-faucet',
            'general_maintenance': 'fa-tools', 'painter': 'fa-paint-roller', 'carpenter': 'fa-hammer', 'Finisher': 'fa-palette',
            'blacksmith': 'fa-industry', 'builder': 'fa-hard-hat', 'house_cleaner': 'fa-broom',
            'aluminum_tech': 'fa-window-maximize', 'glass_tech': 'fa-vector-square', 'car_mechanic': 'fa-wrench', 'car_electrician': 'fa-car-battery',
            'tire_tech': 'fa-circle-notch', 'car_wash': 'fa-shuttle-van', 'motorcycle_repair': 'fa-motorcycle',
            'taxi_driver': 'fa-taxi', 'delivery_services': 'fa-truck-fast', 'tow_truck': 'fa-truck-pickup',
            'cctv_installer': 'fa-video', 'party_planner': 'fa-magic', 'zaffa_bands': 'fa-music',
            'music_bands': 'fa-guitar',  'party_rental': 'fa-chair',
            'home_nurse': 'fa-user-nurse', 'masseur': 'fa-hands-holding', 'cupping_specialist': 'fa-kit-medical',
            'nutritionist': 'fa-apple-whole', 'truck_driver': 'fa-truck', 'security_firms': 'fa-shield-halved',
            'furniture_buyer': 'fa-couch', 'gardener': 'fa-leaf', 'pet_care': 'fa-dog',
            'clown_entertainer': 'fa-face-smile-beam', 'online_stores': 'fa-shopping-basket', 'villas_rent': 'fa-vihara',
            'martial_arts_gymnastics': 'fa-user-ninja', 'public_parks_recreation': 'fa-tree', 'hotels': 'fa-hotel',
            'free_distribution': 'fa-gift', 'barber_shop': 'fa-cut', 'photographers': 'fa-camera-retro', 'video_design_ads': 'fa-film',
            'pharmacies_on_call': 'fa-pills', 'taxis_on_call': 'fa-hand-holding-usd', 'emergency_hospitals': 'fa-hospital',
            'clinics': 'fa-stethoscope', 'doctors_on_call': 'fa-user-md', 'ambulances_on_call': 'fa-ambulance',
            'music_training': 'fa-music', 'lawyers': 'fa-gavel', 'land_surveyors': 'fa-ruler-combined',
            'real_estate_valuers': 'fa-calculator', 'private_tutors': 'fa-chalkboard-teacher', 'programmers': 'fa-code',
            'car_delivery_on_call': 'fa-car', 'motorcycle_delivery_on_call': 'fa-motorcycle',
            'bicycle_delivery_on_call': 'fa-bicycle',
            'student_research_assist': 'fa-book',
            // --- الطبقات الجديدة (6) ---
            'supermarket': 'fa-store', 'commercial_shops': 'fa-shop', 'restaurants': 'fa-utensils',
            'schools_kindergartens': 'fa-school', 'job_vacancies': 'fa-briefcase', 'city_landmarks': 'fa-landmark'
            
        };

        const serviceNames = {
            'road_barriers': 'حواجز الطرق', 'fuel_stations': 'محطات الوقود',
            'electrician': 'فني كهرباء', 'ac_technician': 'فني تكييف وتبريد', 'plumber': 'سباك (مواسيرجي)',
            'general_maintenance': 'صيانة عامة', 'painter': 'دهان/طراشة', 'Finisher': 'فني ديكور', 'carpenter': 'نجار',
            'blacksmith': 'حداد', 'builder': 'بناء ومعمار', 'house_cleaner': 'خدمات تنظيف', 'aluminum_tech': 'فني ألمنيوم', 'glass_tech': 'فني زجاج وسكريت',
            'car_mechanic': 'ميكانيكي سيارات', 'car_electrician': 'كهربائي سيارات', 'tire_tech': 'بنشري / إطارات',
            'car_wash': 'غسيل سيارات', 'motorcycle_repair': 'صيانة دراجات نارية', 'taxi_driver': 'مكتب تاكسي',
            'delivery_services': 'خدمات توصيل', 'tow_truck': 'ونش إنقاذ', 'cctv_installer': 'فني كاميرات مراقبة',
            'party_planner': 'منظم حفلات', 'zaffa_bands': 'فرقة زفة', 'music_bands': 'فرق موسيقية',
            'party_rental': 'تأجير مستلزمات حفلات', 'home_nurse': 'تمريض منزلي',
            'masseur': 'أخصائي مساج', 'cupping_specialist': 'أخصائي حجامة', 'nutritionist': 'أخصائي تغذية',
            'truck_driver': 'سائق شاحنة', 'security_firms': 'شركات أمن وحراسة', 'furniture_buyer': 'شراء أثاث مستعمل',
            'gardener': 'تنسيق حدائق', 'pet_care': 'رعاية حيوانات أليفة', 'clown_entertainer': 'مهرج وعروض أطفال',
            'online_stores': 'متاجر أون لاين', 'villas_rent': 'فلل أجار', 'martial_arts_gymnastics': 'فنون قتالية وجمباز',
            'public_parks_recreation': 'حدائق ومناطق ترفيهية', 'hotels': 'فنادق', 'free_distribution': 'توزيع أغراض مجاناً',
            'barber_shop': 'حلاقة شباب', 'photographers': 'مصور فوتوغرافي', 'video_design_ads': 'تصميم فيديو إعلاني', 'pharmacies_on_call': 'صيدليات مناوبة',
            'taxis_on_call': 'تكاسي نظام مناوبة', 'emergency_hospitals': 'طوارئ ومستشفيات', 'clinics': 'عيادات',
            'doctors_on_call': 'دكاترة مناوبة', 'ambulances_on_call': 'إسعاف مناوبة', 'music_training': 'تدريب موسيقى ومعاهد',
            'lawyers': 'محاميين', 'land_surveyors': 'مساحين أراضي', 'real_estate_valuers': 'مخمنين عقاريين',
            'private_tutors': 'أساتذة خصوصي', 'programmers': 'مبرمجين', 'car_delivery_on_call': 'دليفري سيارات (مناوبة)',
            'motorcycle_delivery_on_call': 'دليفري دراجات (مناوبة)', 'bicycle_delivery_on_call': 'دليفري هوائية (مناوبة)',
            'student_research_assist': 'مساعد أبحاث طلاب',
            // --- الطبقات الجديدة (6) ---
            'supermarket': 'سوبرماركت', 'commercial_shops': 'محلات تجارية', 'restaurants': 'مطاعم وكوفي شوبات',
            'schools_kindergartens': 'مدارس ورياض أطفال', 'job_vacancies': 'وظائف شاغرة', 'city_landmarks': 'معالم المدينة'
            
        };

                // 🆕 قراءة الاستثناءات من ملف التكوين المركزي (config.js) بدل مصفوفة فارغة
        // محلية كانت تمنع أي استثناء من الانعكاس على صفحة البحث بدون خريطة إطلاقاً
        const globalExclusions = (typeof MAP_CONFIG !== 'undefined' && MAP_CONFIG.globalExclusions) || [];

        // ==========================================================================
        // تصنيف الفروع (التبويبات): كل خدمة أو عقار يتبع فرعاً واحداً لتسهيل الفلترة.
        // العرض الافتراضي "الكل" يبقى يعرض كافة الـ 62 فئة كما هو معتاد.
        // ==========================================================================
        const groupDefs = [
            { id: 'all',        title: 'الكل',                    icon: 'fa-border-all' },
            // 🆕 فرعان مستقلان (نفس أسلوب مدارس ورياض الأطفال): كل منهما يحتوي
            // طبقة واحدة فقط، فيُفتح مباشرة عند النقر بدل عرض شبكة فئات فرعية
            { id: 'roads',       title: 'حواجز الطرق',            icon: 'fa-signs-post' },
            { id: 'fuel',        title: 'محطات الوقود',           icon: 'fa-gas-pump' },
            { id: 'realestate',   title: 'العقارات',                icon: 'fa-building' },
            { id: 'technicians',  title: 'الفنيين والصيانة',        icon: 'fa-tools' },
            { id: 'health',       title: 'الصحة والرعاية',          icon: 'fa-briefcase-medical' },
            { id: 'vehicles',     title: 'المركبات والتوصيل',      icon: 'fa-car' },
            { id: 'professional', title: 'المهن الحرة والخصوصي',    icon: 'fa-user-tie' },
            { id: 'events',       title: 'مناسبات وضيافة وترفيه',   icon: 'fa-champagne-glasses' },
            { id: 'misc',         title: 'متفرقات',                icon: 'fa-ellipsis' },
            // --- الفروع الجديدة (4) ---
            { id: 'landmarks',    title: 'معالم المدينة',          icon: 'fa-landmark' },
            { id: 'commercial',    title: 'محلات تجارية ومطاعم',    icon: 'fa-store' },
            { id: 'education',    title: 'مدارس ورياض أطفال',      icon: 'fa-school' },
            { id: 'jobs',         title: 'وظائف شاغرة',            icon: 'fa-briefcase' }
        ];

        // خريطة تصنيف كل خدمة (المفتاح البرمجي كما في serviceNames) إلى الفرع المناسب
        const serviceGroupMap = {
            // 🛠️ الفنيين والصيانة المنزلية
            electrician: 'technicians', ac_technician: 'technicians', plumber: 'technicians',
            general_maintenance: 'technicians', painter: 'technicians', Finisher: 'technicians', carpenter: 'technicians',
            blacksmith: 'technicians', builder: 'technicians', house_cleaner: 'technicians',
            aluminum_tech: 'technicians', glass_tech: 'technicians', cctv_installer: 'technicians', gardener: 'technicians',
            security_firms: 'technicians', furniture_buyer: 'technicians',

            // 🩺 الصحة والرعاية
            home_nurse: 'health', masseur: 'health', cupping_specialist: 'health',
            nutritionist: 'health', pharmacies_on_call: 'health', emergency_hospitals: 'health',
            clinics: 'health', doctors_on_call: 'health', ambulances_on_call: 'health',
            pet_care: 'health',

            // 🚗 المركبات والتوصيل
            car_mechanic: 'vehicles', car_electrician: 'vehicles', tire_tech: 'vehicles',
            car_wash: 'vehicles', motorcycle_repair: 'vehicles', taxi_driver: 'vehicles',
            delivery_services: 'vehicles', tow_truck: 'vehicles', truck_driver: 'vehicles',
            taxis_on_call: 'vehicles', car_delivery_on_call: 'vehicles',
            motorcycle_delivery_on_call: 'vehicles', bicycle_delivery_on_call: 'vehicles',

            // 👔 المهن الحرة والخصوصي
            lawyers: 'professional', land_surveyors: 'professional', real_estate_valuers: 'professional',
            private_tutors: 'professional', programmers: 'professional', music_training: 'professional',
            student_research_assist: 'professional',

            // 🎉 مناسبات وضيافة وترفيه
            party_planner: 'events', zaffa_bands: 'events', music_bands: 'events',
            party_rental: 'events', clown_entertainer: 'events',
            martial_arts_gymnastics: 'events', public_parks_recreation: 'events', hotels: 'events',
            villas_rent: 'events', barber_shop: 'events', video_design_ads: 'events',
            photographers: 'events',

                        // 📦 متفرقات
            online_stores: 'misc', free_distribution: 'misc',

            // --- الطبقات الجديدة (6) ---
            supermarket: 'commercial', commercial_shops: 'commercial', restaurants: 'commercial',
            schools_kindergartens: 'education', job_vacancies: 'jobs', city_landmarks: 'landmarks',

            // 🆕 فرعان مستقلان بدل بقائهما ضمن "متفرقات"
            fuel_stations: 'fuel', road_barriers: 'roads',
        };

                const categories = [
            { key: 'rentLayer', title: 'شقق الإيجار', icon: iconMap['rentLayer'], isRealEstate: true, group: 'realestate' },
            { key: 'saleLayer', title: 'شقق للبيع', icon: iconMap['saleLayer'], isRealEstate: true, group: 'realestate' },
            { key: 'landLayer', title: 'الأراضي للبيع', icon: iconMap['landLayer'], isRealEstate: true, group: 'realestate' }
        ].filter(c => !window.isLayerGloballyExcluded(c.key));

        Object.keys(serviceNames).forEach(key => {
            if (window.isLayerGloballyExcluded(key)) return;
            categories.push({
                key: key + 'Layer',
                title: serviceNames[key],
                icon: iconMap[key] || 'fa-question-circle',
                isRealEstate: false,
                group: serviceGroupMap[key] || 'misc'
            });
        });

        const layerNameMap = { rentLayer: 'ApartRent', saleLayer: 'ApartSale', landLayer: 'LandSale' };

        function getWorkspaceAndName(layerKey) {
            const isRealEstate = ['rentLayer', 'saleLayer', 'landLayer'].includes(layerKey);
            return {
                workspace: isRealEstate ? 'realestate' : 'services',
                layerName: layerNameMap[layerKey] || layerKey.replace('Layer', ''),
                isRealEstate
            };
        }

        // ==========================================================================
        // 2) عرض شبكة الفئات
        // ==========================================================================
        const categoriesGrid = document.getElementById('nms-categories-grid');
        const categoriesView = document.getElementById('nms-categories-view');
        const resultsView = document.getElementById('nms-results-view');
        const backBtn = document.getElementById('nms-back-to-categories');
        const categoryTitleEl = document.getElementById('nms-current-category-title');
        const groupsTabsEl = document.getElementById('nms-groups-tabs');

        if (!categoriesGrid) return; // الخروج إذا لم تكن عناصر الصفحة موجودة

        let activeGroup = 'all';

        function renderCategoriesGrid(groupId) {
            categoriesGrid.innerHTML = '';
            const filtered = (!groupId || groupId === 'all') ? categories : categories.filter(c => c.group === groupId);

            if (filtered.length === 0) {
                categoriesGrid.innerHTML = '<div class="nms-empty">لا توجد فئات ضمن هذا الفرع حالياً.</div>';
                return;
            }

            filtered.forEach((cat, index) => {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'nms-category-card';
                card.style.setProperty('--i', Math.min(index, 24)); // تهدئة التتابع بعد أول 24 عنصر
                card.innerHTML = `<i class="fas ${cat.icon}"></i><span>${cat.title}</span>`;
                card.onclick = () => openCategory(cat);
                categoriesGrid.appendChild(card);
            });
        }

        function renderGroupsTabs() {
            if (!groupsTabsEl) return;
            groupsTabsEl.innerHTML = '';
            groupDefs.forEach((g, gIndex) => {
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = 'nms-group-tab' + (g.id === activeGroup ? ' active' : '');
                tab.style.setProperty('--i', gIndex);
                tab.dataset.group = g.id;
                tab.innerHTML = `<i class="fas ${g.icon}"></i><span>${g.title}</span>`;
                tab.onclick = () => {
                    activeGroup = g.id;
                    groupsTabsEl.querySelectorAll('.nms-group-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');

                    // التحقق من عدد الطبقات في الفرع
                    const categoriesInGroup = categories.filter(c => c.group === g.id);

                    // إذا كان الفرع يحتوي على طبقة واحدة فقط، عرض المعالم مباشرة
                    if (categoriesInGroup.length === 1 && g.id !== 'all') {
                        const singleCategory = categoriesInGroup[0];
                        openCategory(singleCategory);
                    } else {
                        // عرض الفئات الفرعية للفروع التي تحتوي على أكثر من طبقة
                        renderCategoriesGrid(activeGroup);
                        categoriesGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                };
                groupsTabsEl.appendChild(tab);
            });
        }

        renderGroupsTabs();
        renderCategoriesGrid(activeGroup); // العرض الافتراضي: الكل (62 فئة)

        // ==========================================================================
        // 🆕 الإعلانات المميزة (يمين/يسار/أسفل) - نسخة موحّدة تجلب عقارات وخدمات معاً
        // وتحل مشكلتي: (أ) ظهور العقارات فقط، (ب) الفراغ الكبير أسفل الإعلانات
        // ==========================================================================
                function escapeAdAttr(str) {
            if (str === null || str === undefined) return '';
            return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // 🆕 ودجت تقييم موحّد (نجوم + عدد + زر "عرض التعليقات") يُستخدم بكل من:
        // الإعلانات المميزة، الأعلى تقييماً، موصى بهم. يعتمد على data-layer/
        // data-feature-id بدل id فريد، لأن نفس البطاقة قد تُستنسخ عدة مرات
        // بأعمدة مختلفة (يمين/يسار/أسفل)، وكل نسخة تُحيّى (hydrate) بشكل مستقل.
        function buildRatingWidgetHtml(layer, featureId) {
            if (!layer || featureId === undefined || featureId === null || featureId === '') return '';
            return `<div class="nms-rating-display" data-layer="${escapeAdAttr(layer)}" data-feature-id="${escapeAdAttr(String(featureId))}" style="margin:6px 0; font-size:11px;">
                <span style="color:#f57c00;">⭐</span>
                <span class="nms-rating-text" style="color:#666; font-size:11px;">جاري تحميل التقييم...</span>
            </div>`;
        }

        async function hydrateRatingWidgets(container) {
            if (!container) return;
            const widgets = container.querySelectorAll('.nms-rating-display[data-layer]');
            for (const widget of widgets) {
                if (widget.dataset.hydrated) continue;
                widget.dataset.hydrated = '1';
                const layer = widget.dataset.layer;
                const featureId = widget.dataset.featureId;
                try {
                    const response = await fetch(`${window.location.origin}/api/service-ratings?service_layer=${layer}&feature_id=${featureId}`);
                    const data = await response.json();
                    const textEl = widget.querySelector('.nms-rating-text');
                    if (!textEl) continue;

                    if (data.success && data.totalRatings > 0) {
                        const stars = '★'.repeat(Math.round(data.averageRating)) + '☆'.repeat(5 - Math.round(data.averageRating));
                        textEl.innerHTML = `<span style="color:#ffc107;">${stars}</span> <span style="color:#333; font-weight:bold;">${data.averageRating}</span> <span style="color:#666;">(${data.totalRatings} تقييم)</span>`;

                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.innerHTML = `💬 عرض التعليقات (${data.totalRatings})`;
                        btn.style.cssText = 'margin-top:6px; padding:4px 8px; background:#1a73e8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px; display:block; width:100%;';

                        const commentsDiv = document.createElement('div');
                        commentsDiv.style.cssText = 'display:none; margin-top:8px; max-height:180px; overflow-y:auto; border-top:1px solid #eee; padding-top:6px;';

                        btn.onclick = () => {
                            if (commentsDiv.style.display === 'none') {
                                commentsDiv.style.display = 'block';
                                if (!data.ratings || data.ratings.length === 0) {
                                    commentsDiv.innerHTML = '<div style="color:#999; font-size:12px;">لا توجد تعليقات</div>';
                                } else {
                                    commentsDiv.innerHTML = data.ratings.map(r => `
                                        <div style="padding:6px; background:#f9f9f9; border-radius:4px; margin-bottom:6px;">
                                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                                <span style="font-weight:bold; font-size:12px; color:#333;">${sanitize(r.user_name || 'مستخدم')}</span>
                                                <span style="color:#ffc107; font-size:13px;">${'★'.repeat(r.rating)}</span>
                                            </div>
                                            ${r.comment ? `<div style="font-size:12px; color:#666; line-height:1.4;">${sanitize(r.comment)}</div>` : ''}
                                            <div style="font-size:10px; color:#999; margin-top:4px;">${new Date(r.created_at).toLocaleDateString('ar-EG')}</div>
                                        </div>
                                    `).join('');
                                }
                            } else {
                                commentsDiv.style.display = 'none';
                            }
                        };

                        widget.appendChild(btn);
                        widget.appendChild(commentsDiv);
                    } else {
                        textEl.innerHTML = '<span style="color:#999;">لا توجد تقييمات بعد</span>';
                    }
                } catch (err) {
                    // تجاهل فشل جلب تقييم بطاقة واحدة، لا يوقف باقي البطاقات
                }
            }
        }

                function buildAdCardHtml(props, item) {
            const isRealEstate = item.isRealEstate;
            const name = sanitize(props.name || props.location_name || props.location || '');
            const location = sanitize(props.location_name || props.location || '');

            // 🆕 [إصلاح]: بدل شارة نجوم ثابتة بدون أي تفاعل، نستخدم ودجت التقييم
            
            const featureIdForRating = (!isRealEstate && props.id !== undefined && props.id !== null && props.id !== '') ? props.id : null;
            const ratingBadgeHtml = featureIdForRating !== null ? buildRatingWidgetHtml(item.layer, featureIdForRating) : '';

            let statusHtml = '';
            if (!isRealEstate) {
                const isAvailable = parseInt(props.auto_status) === 0;
                const color = isAvailable ? '#28a745' : '#dc3545';
                const text = isAvailable ? 'متاح الآن' : 'مغلق حالياً';
                statusHtml = `<div style="font-size:10px; font-weight:bold; color:${color}; border:1px dashed ${color}; border-radius:6px; padding:3px 6px; display:inline-block; margin-bottom:4px;">${isAvailable ? '🟢' : '🔴'} ${text}</div>`;
            }

            let detailsHtml = '';
            if (isRealEstate) {
                if (props.price) {
                    const symbols = { USD: 'دولار', ILS: 'شيكل', JOD: 'دينار' };
                    detailsHtml += `<div style="color:#2e7d32; font-weight:bold; font-size:11px; margin-bottom:2px;">💰 ${Number(props.price).toLocaleString()} ${symbols[props.currency] || ''}</div>`;
                }
                if (props.area) detailsHtml += `<div style="color:#666; font-size:10px; margin-bottom:2px;">📐 ${props.area} م²</div>`;
                if (props.village_a) detailsHtml += `<div style="color:#555; font-size:10px; margin-bottom:2px;">🏘️ ${sanitize(props.village_a)}</div>`;
            }
            if (props.des) {
                detailsHtml += `<div style="background:#f9f9f9; padding:4px 6px; border-radius:5px; color:#555; font-size:10px; margin-bottom:2px; word-wrap: break-word; white-space: normal;">📝 ${sanitize(props.des)}</div>`;
            }

            let actionHtml = '';
            if (props.whatsapp) {
                const providerName = name || (isRealEstate ? 'المعلن' : 'مزود الخدمة');
                const whatsappNumber = props.whatsapp.toString();
                                if (isRealEstate) {
                    const hasPhone = props.phone !== undefined && props.phone !== null && props.phone !== '' && String(props.phone).trim() !== '';
                    const localPhone = hasPhone ? String(props.phone) : ('0' + whatsappNumber.replace(/\D/g, '').slice(5));
                    // 🆕 [إصلاح]: العقارات تستخدم عمود fid وليس id، وكان استخدام props.id فقط
                    // يجعل feature_id فارغاً دائماً للعقارات، فيرفضه السيرفر ولا يُسجَّل شيء
                    const realEstateFeatureId = (props.fid !== undefined && props.fid !== null) ? props.fid : props.id;
                                        actionHtml = `
                        <div style="display:flex; gap:5px; margin-top:6px;">
                            ${hasPhone ? `<button class="ad-call-btn" data-phone="${localPhone}" data-whatsapp="${whatsappNumber}" data-provider="${escapeAdAttr(providerName)}" data-service="${escapeAdAttr(item.label)}" data-layer="${escapeAdAttr(item.layer)}" data-feature-id="${escapeAdAttr(String(realEstateFeatureId || ''))}" style="flex:1; background:#1a73e8; color:#fff; border:none; padding:6px 4px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;"><i class="fas fa-mobile-alt"></i> اتصال <span dir="ltr">${localPhone}</span></button>` : ''}
                            <button class="ad-whatsapp-btn" data-whatsapp="${whatsappNumber}" data-provider="${escapeAdAttr(providerName)}" data-service="${escapeAdAttr(item.label)}" data-layer="${escapeAdAttr(item.layer)}" data-feature-id="${escapeAdAttr(String(realEstateFeatureId || ''))}" style="flex:${hasPhone ? '1' : '1'}; background:#25d366; color:#fff; border:none; padding:6px 4px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;"><i class="fab fa-whatsapp"></i> واتساب</button>
                        </div>`;
                } else {
                    // 🆕 للخدمات: نتحقق هل المعلم مرتبط بمزود خدمة
                    const layerDbName = item.layer;
                    const featureId = (props.id !== undefined && props.id !== null) ? props.id : '';
                    const isLinkedProvider = typeof window.isFeatureLinkedToProvider === 'function' && window.isFeatureLinkedToProvider(layerDbName, featureId);
                    
                    if (isLinkedProvider) {
                        // معلم مرتبط بمزود خدمة - عرض زر طلب الخدمة
                        actionHtml = `
                            <div style="margin-top:6px;">
                                <button class="req-svc-btn" data-provider="${escapeAdAttr(providerName)}" data-service="${escapeAdAttr(item.label)}" data-layer="${layerDbName}" data-feature-id="${featureId}" style="width:100%; background:linear-gradient(135deg,#1a73e8,#6c5ce7); color:#fff; border:none; padding:6px 4px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;">
                                    <i class="fas fa-paper-plane"></i> طلب الخدمة
                                </button>
                            </div>`;
                                        } else {
                        // معلم غير مرتبط - عرض اتصال + واتساب
                        const hasPhone = props.phone !== undefined && props.phone !== null && props.phone !== '' && String(props.phone).trim() !== '';
                        const localPhone = hasPhone ? String(props.phone) : ('0' + whatsappNumber.replace(/\D/g, '').slice(5));
                        actionHtml = `
                            <div style="display:flex; gap:5px; margin-top:6px;">
                                ${hasPhone ? `<button class="ad-call-btn" data-phone="${localPhone}" data-whatsapp="${whatsappNumber}" data-provider="${escapeAdAttr(providerName)}" data-service="${escapeAdAttr(item.label)}" data-layer="${escapeAdAttr(item.layer)}" data-feature-id="${escapeAdAttr(String(props.id || ''))}" style="flex:1; background:#1a73e8; color:#fff; border:none; padding:6px 4px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;"><i class="fas fa-mobile-alt"></i> اتصال <span dir="ltr">${localPhone}</span></button>` : ''}
                                <button class="ad-whatsapp-btn" data-whatsapp="${whatsappNumber}" data-provider="${escapeAdAttr(providerName)}" data-service="${escapeAdAttr(item.label)}" data-layer="${escapeAdAttr(item.layer)}" data-feature-id="${escapeAdAttr(String(props.id || ''))}" style="flex:${hasPhone ? '1' : '1'}; background:#25d366; color:#fff; border:none; padding:6px 4px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;"><i class="fab fa-whatsapp"></i> واتساب</button>
                            </div>`;
                    }
                }
            }

                        return `
                <div style="background:#fff; border:2px solid #fbc02d; border-radius:8px; padding:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1); box-sizing:border-box; text-align:right; direction:rtl; width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="background:#fbc02d; color:#000; font-size:9px; padding:2px 5px; border-radius:4px; font-weight:bold;">${item.badgeText || '⭐ مميز'}</span>
                        <span style="background:#e8f0fe; color:#1a73e8; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:bold;">📌 ${item.label}</span>
                    </div>
                    ${ratingBadgeHtml}
                    ${statusHtml}
                    ${name ? `<div style="font-weight:bold; color:#202124; font-size:12px; margin-bottom:4px;"><i class="fas fa-user" style="color:#1a73e8;"></i> ${name}</div>` : ''}
                    ${location ? `<div style="color:#555; font-size:11px; margin-bottom:3px;"><i class="fas fa-map-marker-alt" style="color:#e74c3c;"></i> ${location}</div>` : ''}
                    ${detailsHtml}
                    ${actionHtml}
                </div>
            `;
        }

                async function loadFeaturedAds() {
            const adSpaces = document.querySelectorAll('.nms-ad-space');
            if (!adSpaces.length) return;

            let allValidCards = [];

            // 🆕 نبني قائمة الأهداف من نفس مصفوفة categories الموجودة أصلاً بالملف
            // (62 فئة: عقارات + كل الخدمات)، بدل الاعتماد على MAP_CONFIG/serviceTranslations
            // غير الموجودين أصلاً بهذه الصفحة
            const allTargets = categories.map(cat => {
                const { workspace, layerName, isRealEstate } = getWorkspaceAndName(cat.key);
                return { layer: layerName, workspace, label: cat.title, isRealEstate };
            });

            const batchSize = 10;
            for (let i = 0; i < allTargets.length; i += batchSize) {
                const batch = allTargets.slice(i, i + batchSize);
                const promises = batch.map(async (item) => {
                    try {
                        const params = new URLSearchParams({
                            layer: item.layer,
                            workspace: item.workspace,
                            field_0: 'rating',
                            operator_0: '=',
                            value_0: '10',
                            conditions_count: '1'
                        });
                        const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
                        if (!response.ok) return [];
                        const data = await response.json();
                        const features = data.features || [];
                        return features.map(f => buildAdCardHtml(f.properties || {}, item));
                    } catch (err) {
                        return [];
                    }
                });
                const results = await Promise.all(promises);
                results.forEach(cards => { if (cards.length) allValidCards.push(...cards); });
            }

            function shuffleArray(array) {
                let arr = [...array];
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            }

            // 🆕 نخزّن كامل مجموعة الكروت عالمياً حتى تستطيع دالة إعادة التعبئة
            // (refillAllSideAds) الوصول إليها لاحقاً عند تغيّر حجم الشاشة أو
            // تغيّر طول المحتوى الأوسط (فتح تصنيف مختلف، تنفيذ بحث/فلترة...)
            window.__nmsAdCardPool = allValidCards;

            adSpaces.forEach((space) => {
                space.innerHTML = '';

                if (allValidCards.length === 0) {
                    space.innerHTML = `<div style="padding:10px; text-align:center; font-size:11px; color:#777;">لا توجد إعلانات مميزة</div>`;
                    return;
                }

                const randomizedCards = shuffleArray(allValidCards);

                if (space.classList.contains('nms-ad-bottom')) {
                    const selectedCards = randomizedCards.slice(0, 4);
                    space.style.cssText += `
                        display: flex;
                        flex-direction: row;
                        justify-content: flex-start;
                        gap: 15px;
                        overflow-x: auto;
                        overflow-y: hidden;
                        padding: 10px;
                        box-sizing: border-box;
                        width: 100%;
                    `;
                    const styledCards = selectedCards.map(card => card.replace('width: 100%;', 'width: 24%; min-width: 240px;'));
                    space.innerHTML = styledCards.join('');
                    wireAdActionButtons(space);
                                } else {
                    // 🆕 الإصلاح الجذري لمشكلة الفراغ (شكل حرف U المطلوب): لا نستخدم
                    // align-self:stretch إطلاقاً (كان يسبب حلقة تغذية راجعة تجعل
                    // الصفحة تكبر بلا نهاية - راجع getMainNaturalHeight أدناه لشرح
                    // المشكلة). بدلاً من ذلك نستخدم flex-start، ونُعطي العمود ارتفاعاً
                    // ثابتاً بالبكسل يُحسب من الارتفاع الطبيعي لـ .nms-main، ثم نملأه
                    // بعدد كافٍ من البطاقات (مع تكرار نفس المجموعة عند نفادها).
                    space.style.cssText += `
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        align-self: flex-start;
                        gap: 15px;
                        padding: 10px 0;
                        box-sizing: border-box;
                        overflow: hidden;
                    `;
                    requestAnimationFrame(() => fillAdSideWithPool(space, randomizedCards));
                }
            });
        }

                        // 🆕 [إصلاح حلقة التغذية الراجعة]: align-self:stretch كان يجعل .nms-main
        // نفسه يتمدد ليطابق ارتفاع العمود الجانبي، فتتضخم الصفحة بلا نهاية مع كل
        // إعادة تعبئة. الحل: نفرض align-items:flex-start على .nms-layout لمنع أي
        // تمدد تلقائي بين الأعمدة، فيبقى ارتفاع .nms-main معبّراً دائماً عن محتواه
        // الفعلي فقط، بغض النظر عن طول الأعمدة الجانبية بجانبه.
        function getMainNaturalHeight() {
            const layoutEl = document.querySelector('.nms-layout');
            const mainEl = document.querySelector('.nms-main');
            if (!mainEl) return 0;
            if (layoutEl) {
                layoutEl.style.setProperty('align-items', 'flex-start', 'important');
            }
            return mainEl.getBoundingClientRect().height;
        }

        // 🆕 تملأ عموداً جانبياً واحداً ببطاقات كافية (مع تكرار المجموعة المتاحة
        // دورياً عند نفادها) حتى يغطي بالضبط الارتفاع الطبيعي لـ .nms-main، عبر
        // ارتفاع ثابت بالبكسل (وليس stretch) لمنع أي حلقة تغذية راجعة.
        function fillAdSideWithPool(sideEl, cardsPool, attempt) {
            if (!sideEl || !cardsPool || cardsPool.length === 0) return;
            attempt = attempt || 0;

            const targetHeight = getMainNaturalHeight();

            if (!targetHeight) {
                // الصفحة أو المحتوى لم يكتمل رسمه بعد - أعد المحاولة بضع مرات
                // قبل الاستسلام نهائياً (حد أقصى نصف ثانية تقريباً)
                if (attempt < 20) {
                    requestAnimationFrame(() => fillAdSideWithPool(sideEl, cardsPool, attempt + 1));
                }
                return;
            }

            sideEl.innerHTML = '';
            // 🆕 ارتفاع ثابت بالبكسل مأخوذ من القياس أعلاه - لا يتغيّر تبعاً لعدد
            // الكروت التي سنضيفها، وبالتالي لا يوجد أي حلقة تغذية راجعة ممكنة
            sideEl.style.height = targetHeight + 'px';

            let poolIndex = 0;
            let safetyCounter = 0;
            while (sideEl.scrollHeight < targetHeight && safetyCounter < 150) {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = cardsPool[poolIndex % cardsPool.length];
                const cardNode = wrapper.firstElementChild;
                if (cardNode) sideEl.appendChild(cardNode);
                poolIndex++;
                safetyCounter++;
            }

            wireAdActionButtons(sideEl);
        }

        // 🆕 إعادة تعبئة كل الأعمدة الجانبية (يمين ويسار) دفعة واحدة - تُستدعى
        // عند تغيّر حجم الشاشة أو تغيّر ارتفاع القسم الأوسط (فتح تصنيف مختلف،
        // تنفيذ بحث أو فلترة تُغيّر عدد النتائج المعروضة...)
        function refillAllSideAds() {
            const pool = window.__nmsAdCardPool;
            if (!pool || pool.length === 0) return;
            document.querySelectorAll('.nms-ad-space.nms-ad-side').forEach(sideEl => {
                fillAdSideWithPool(sideEl, pool);
            });
        }

        (function setupSideAdsAutoRefill() {
            let resizeToken = null;
            window.addEventListener('resize', () => {
                clearTimeout(resizeToken);
                resizeToken = setTimeout(refillAllSideAds, 250);
            });

            const mainEl = document.querySelector('.nms-main');
            if (mainEl && typeof ResizeObserver !== 'undefined') {
                let roToken = null;
                const ro = new ResizeObserver(() => {
                    // 🆕 نتجاهل أي تغيّر ارتفاع ناتج عن تعديلنا نحن لارتفاع الأعمدة
                    // الجانبية (لا يمكن حدوثه أصلاً الآن لأن .nms-main لم يعد يتمدد،
                    // لكن كإجراء أمان إضافي نُبقي الـ debounce لتفادي أي استدعاءات
                    // متلاحقة أثناء تغييرات DOM سريعة مثل فتح تصنيف جديد)
                    clearTimeout(roToken);
                    roToken = setTimeout(refillAllSideAds, 250);
                });
                ro.observe(mainEl);
            }
        })();
        // تفعيل أزرار الاتصال/واتساب الخاصة بكروت الإعلانات (تسجيل تتبع + فحص حد الطلبات)
                // 🆕 ربط مباشر (وليس عام) لأزرار الاتصال/واتساب الخاصة بكروت الإعلانات،
        // مع تسجيل تتبع + فحص حد الطلبات + تسجيل النقرة في /api/log-contact-click.
        // يُستدعى بعد كل مرة تُحقَن فيها كروت جديدة (إعلانات، أعلى تقييماً، موصى بهم)
                function wireAdActionButtons(container) {
            if (!container) return;

            
            hydrateRatingWidgets(container);

            container.querySelectorAll('.ad-call-btn').forEach(callBtn => {
                if (callBtn.dataset.wired) return;
                callBtn.dataset.wired = '1';
                callBtn.addEventListener('click', async () => {
                    const phone = callBtn.dataset.phone;
                    const provider = callBtn.dataset.provider;
                    const service = callBtn.dataset.service;
                    const layer = callBtn.dataset.layer || '';
                    const featureId = callBtn.dataset.featureId || '';

                    const cooldownKey = `click_cooldown_call_${featureId}`;
                    const lastClickTime = localStorage.getItem(cooldownKey);
                    const now = Date.now();
                    if (lastClickTime && (now - parseInt(lastClickTime)) / 1000 < 10) {
                        const remaining = Math.ceil(10 - (now - parseInt(lastClickTime)) / 1000);
                        if (window.toast) window.toast(`يرجى الانتظار ${remaining} ثوانٍ قبل المحاولة مرة أخرى`, 'warning', 3000);
                        else alert(`يرجى الانتظار ${remaining} ثوانٍ قبل المحاولة مرة أخرى.`);
                        return;
                    }
                    localStorage.setItem(cooldownKey, now.toString());

                    const quota = await checkRequestQuotaOrAlert(getRealUserId(), null);
                    if (!quota.allowed) return;

                    try {
                        await fetch(window.location.origin + '/api/log-contact-click', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: getRealUserId(),
                                service_layer: layer,
                                feature_id: featureId,
                                provider_name: provider,
                                contact_type: 'call'
                            })
                        });
                    } catch (err) {
                        console.error('خطأ في تسجيل نقرة الاتصال:', err);
                    }
                    trackRequest(provider, `(${service}) اتصال مباشر`);
                    window.location.href = 'tel:' + phone;
                });
            });

            container.querySelectorAll('.ad-whatsapp-btn').forEach(waBtn => {
                if (waBtn.dataset.wired) return;
                waBtn.dataset.wired = '1';
                waBtn.addEventListener('click', async () => {
                    const whatsappNumber = waBtn.dataset.whatsapp;
                    const provider = waBtn.dataset.provider;
                    const service = waBtn.dataset.service;
                    const layer = waBtn.dataset.layer || '';
                    const featureId = waBtn.dataset.featureId || '';

                    const cooldownKey = `click_cooldown_whatsapp_${featureId}`;
                    const lastClickTime = localStorage.getItem(cooldownKey);
                    const now = Date.now();
                    if (lastClickTime && (now - parseInt(lastClickTime)) / 1000 < 10) {
                        const remaining = Math.ceil(10 - (now - parseInt(lastClickTime)) / 1000);
                        if (window.toast) window.toast(`يرجى الانتظار ${remaining} ثوانٍ قبل المحاولة مرة أخرى`, 'warning', 3000);
                        else alert(`يرجى الانتظار ${remaining} ثوانٍ قبل المحاولة مرة أخرى.`);
                        return;
                    }
                    localStorage.setItem(cooldownKey, now.toString());

                    const newTab = window.open('', '_blank');
                    const quota = await checkRequestQuotaOrAlert(getRealUserId(), newTab);
                    if (!quota.allowed) return;

                    try {
                        await fetch(window.location.origin + '/api/log-contact-click', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: getRealUserId(),
                                service_layer: layer,
                                feature_id: featureId,
                                provider_name: provider,
                                contact_type: 'whatsapp'
                            })
                        });
                    } catch (err) {
                        console.error('خطأ في تسجيل نقرة الواتساب:', err);
                    }
                    trackRequest(provider, `(${service}) واتساب`);
                    const message = `مرحباً ${provider}، أرغب بالاستفسار عن (${service}) من خلال منصة الخدمات.`;
                    let cleanNumber = (whatsappNumber || '').replace(/\D/g, '');
                    if (cleanNumber.startsWith('00')) cleanNumber = cleanNumber.substring(2);
                    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(message)}`;
                    if (newTab) newTab.location.href = whatsappUrl; else window.open(whatsappUrl, '_blank');
                });
            });
        }

                // ==========================================================================
        // 🆕 الأعلى تقييماً + موصى بهم: نفس تصميم كروت الإعلانات، عرض أفقي 3 كروت
        // على الكمبيوتر مع سكرول عند الزيادة، ويتكيف تلقائياً على الموبايل/التابلت
        // عبر CSS. "الأعلى تقييماً" = أي معلم له تقييم فعلي (rating > 0)، بينما
        // "موصى بهم" = المعالم المقيّمة بالضبط 9.9 (رتبة أقل من رتبة الإعلانات 10)
        // ==========================================================================
                function refreshHomeSectionsVisibility() {
                    const topRatedSection = document.getElementById('nms-top-rated-section');
                    const recommendedSection = document.getElementById('nms-recommended-section');
                    const photosSection = document.getElementById('nms-photos-section');
                    const videosSection = document.getElementById('nms-videos-section');
                    const beforeAfterSection = document.getElementById('nms-before-after-section');

                    // 🆕 الأقسام الخمسة تبقى ظاهرة دائماً طالما تحتوي بيانات، بغض النظر عن
                    // كون المستخدم بشاشة "الرئيسية" أو داخل نتائج تصنيف/فلترة معينة
                    if (topRatedSection) topRatedSection.style.display = (topRatedSection.dataset.hasData === '1') ? '' : 'none';
                    if (recommendedSection) recommendedSection.style.display = (recommendedSection.dataset.hasData === '1') ? '' : 'none';
                    if (photosSection) photosSection.style.display = (photosSection.dataset.hasData === '1') ? '' : 'none';
                    if (videosSection) videosSection.style.display = (videosSection.dataset.hasData === '1') ? '' : 'none';
                    if (beforeAfterSection) beforeAfterSection.style.display = (beforeAfterSection.dataset.hasData === '1') ? '' : 'none';
                }

        // ==========================================================================
        // 🆕 أقسام الصور / الفيديوهات / قبل وبعد - نفس مبدأ فحص "الأعلى تقييماً"
        // و"موصى بهم" (مسح شامل لكل الـ 62 فئة عبر categories)، لكن بشكل عرض مختلف
        // تماماً (شبكة بطاقات كبيرة تُبرز الوسائط بدل الشريط الأفقي الصغير).
        // ==========================================================================

        // تنظيف رابط خارجي (صورة/فيديو/رابط تفاصيل) قبل استخدامه في الصفحة
        function cleanExternalUrl(rawUrl) {
            if (!rawUrl) return '';
            let url = String(rawUrl).trim().replace(/["']/g, '');
            if (!url || url === '#' || url.toLowerCase() === 'undefined') return '';
            if (!url.startsWith('http')) url = 'https://' + url;
            return url;
        }

        // تحويل رابط فيديو (يوتيوب أو ملف مباشر أو رابط عام) إلى عنصر عرض مناسب
        function buildVideoEmbedHtml(rawUrl) {
            const url = cleanExternalUrl(rawUrl);
            if (!url) return '';

            const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
            if (ytMatch) {
                return `<div class="nms-gallery-media nms-gallery-video"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe></div>`;
            }

            if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
                return `<div class="nms-gallery-media nms-gallery-video"><video controls preload="metadata" src="${url}"></video></div>`;
            }

            return `<div class="nms-gallery-media nms-gallery-video-link"><a href="${url}" target="_blank" rel="noopener" class="nms-video-link-btn"><i class="fas fa-play-circle"></i> مشاهدة الفيديو</a></div>`;
        }

        // عرض صورة أو رابط ضمن عمود "قبل" أو "بعد"
        function renderBeforeAfterMedia(url) {
            if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) {
                return `<img src="${url}" loading="lazy" onerror="this.style.display='none'; this.insertAdjacentHTML('afterend', '<div class=\\'nms-ba-empty\\'>تعذر تحميل الصورة</div>');">`;
            }
            return `<a href="${url}" target="_blank" rel="noopener" class="nms-video-link-btn"><i class="fas fa-external-link-alt"></i> عرض</a>`;
        }

                // 🆕 أزرار التواصل (اتصال/واتساب/طلب الخدمة) بنفس آلية تسجيل النقرات
        // المستخدمة بقسم "موصى بهم" و"الأعلى تقييماً" تماماً (نفس الألوان: أزرق
        // للاتصال، أخضر للواتساب، تدرّج بنفسجي/أزرق لطلب الخدمة) + عرض رقم
        // الهاتف مباشرة على زر الاتصال نفسه.
        function buildGalleryContactActionsHtml(props, item) {
            if (!props.whatsapp) return '';
            const isRealEstate = item.isRealEstate;
            const whatsappNumber = props.whatsapp.toString();
            const providerName = props.name || (isRealEstate ? 'المعلن' : 'مزود الخدمة');
            const featureId = (props.id !== undefined && props.id !== null) ? props.id : (props.fid !== undefined ? props.fid : '');

            if (!isRealEstate) {
                const isLinkedProvider = typeof window.isFeatureLinkedToProvider === 'function' && window.isFeatureLinkedToProvider(item.layer, featureId);
                if (isLinkedProvider) {
                    return `<div class="nms-gallery-actions">
                        <button class="req-svc-btn" style="width:100%; background:linear-gradient(135deg,#1a73e8,#6c5ce7); color:#fff; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;" data-provider="${escapeAdAttr(providerName)}" data-service="${escapeAdAttr(item.label)}" data-layer="${item.layer}" data-feature-id="${featureId}">
                            <i class="fas fa-paper-plane"></i> طلب الخدمة
                        </button>
                    </div>`;
                }
            }

            const hasPhone = props.phone !== undefined && props.phone !== null && props.phone !== '' && String(props.phone).trim() !== '';
            const localPhone = hasPhone ? String(props.phone) : ('0' + whatsappNumber.replace(/\D/g, '').slice(5));

            return `<div class="nms-gallery-actions" style="display:flex; gap:8px;">
                ${hasPhone ? `<button class="ad-call-btn" data-phone="${localPhone}" data-whatsapp="${whatsappNumber}" data-provider="${escapeAdAttr(providerName)}" data-service="${escapeAdAttr(item.label)}" data-layer="${escapeAdAttr(item.layer)}" data-feature-id="${escapeAdAttr(String(featureId))}" style="flex:1; background:#1a73e8; color:#fff; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;"><i class="fas fa-mobile-alt"></i> اتصال <span dir="ltr">${localPhone}</span></button>` : ''}
                <button class="ad-whatsapp-btn" data-whatsapp="${whatsappNumber}" data-provider="${escapeAdAttr(providerName)}" data-service="${escapeAdAttr(item.label)}" data-layer="${escapeAdAttr(item.layer)}" data-feature-id="${escapeAdAttr(String(featureId))}" style="flex:1; background:#25d366; color:#fff; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;"><i class="fab fa-whatsapp"></i> واتساب</button>
            </div>`;
        }

        // 🆕 فحص وجود وسائط صالحة فقط (بدون أي آثار جانبية مثل جلب التقييم)،
        // يُستخدم لتصفية النتائج قبل البناء الفعلي لتفادي جلب التقييم مرتين
        function galleryEntryHasMedia(props, mode) {
            if (mode === 'photo') return !!cleanExternalUrl(props.pic);
            if (mode === 'video') return !!cleanExternalUrl(props.video);
            return false;
        }

        // 🆕 حارس بسيط لمنع تكرار طلب نفس التقييم عدة مرات عند إعادة الرسم
        // (مثلاً كل مرة يكتب المستخدم حرفاً بشريط البحث)
        window.__nmsRatingFetchGuard = window.__nmsRatingFetchGuard || new Set();
        function scheduleRatingFetchOnce(layerKey, featureId) {
            const key = `${layerKey}-${featureId}`;
            if (window.__nmsRatingFetchGuard.has(key)) return;
            window.__nmsRatingFetchGuard.add(key);
            setTimeout(() => fetchRatingsForFeature(layerKey, featureId), Math.floor(Math.random() * 500));
        }

        // بطاقة شبكية مفصّلة (صور / فيديوهات)
        function buildGalleryDetailCardHtml(feature, item, mode) {
            const props = feature.properties || {};
            const isRealEstate = item.isRealEstate;
            const name = sanitize(props.name || '');
            const location = sanitize(props.location_name || props.location || '');
            const featureId = (props.id !== undefined && props.id !== null) ? props.id : (props.fid !== undefined ? props.fid : '');

            let mediaHtml = '';
            if (mode === 'photo' && props.pic) {
                const cleanPic = cleanExternalUrl(props.pic);
                if (cleanPic) mediaHtml = `<div class="nms-gallery-media"><img src="${cleanPic}" alt="${name}" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`;
            } else if (mode === 'video' && props.video) {
                mediaHtml = buildVideoEmbedHtml(props.video);
            }
            if (!mediaHtml) return '';

            let infoHtml = `<div class="nms-gallery-card-body">`;
            infoHtml += `<div class="nms-gallery-badge">🏆 ${item.label}</div>`;
            if (!isRealEstate) infoHtml += getStatusBadge(props.auto_status, props.work_hours);
            if (name) infoHtml += `<div class="nms-r-name"><i class="fas fa-user"></i> ${name}</div>`;
            if (location) infoHtml += `<div class="nms-r-loc"><i class="fas fa-map-marker-alt"></i> ${location}</div>`;

            if (isRealEstate) {
                if (props.price) {
                    const symbols = { USD: 'دولار', ILS: 'شيقل', JOD: 'دينار' };
                    infoHtml += `<div class="nms-r-line"><b>💰 السعر:</b> ${Number(props.price).toLocaleString()} ${symbols[props.currency] || ''}</div>`;
                }
                if (props.area) infoHtml += `<div class="nms-r-line"><b>📐 المساحة:</b> ${props.area} م²</div>`;
            } else if (featureId !== '') {
                infoHtml += `<div id="rating-display-${item.layer}-${featureId}" class="nms-rating-display">
                    <span style="color:#f57c00;">⭐</span>
                    <span id="rating-text-${item.layer}-${featureId}" style="color:#666; font-size:12px;">جاري تحميل التقييم...</span>
                </div>`;
                scheduleRatingFetchOnce(item.layer, featureId);
            }

            if (props.des) infoHtml += `<div class="nms-r-desc"><b>📝 الوصف:</b> ${sanitize(props.des)}</div>`;
            infoHtml += `</div>`;

            const actionsHtml = buildGalleryContactActionsHtml(props, item);
            const coords = getFeatureCoords(feature);
            const gotoBtnHtml = coords
                ? `<button type="button" class="nms-goto-map-btn" onclick="window.nmsGotoMapFromCoords(${coords[0]}, ${coords[1]})"><i class="fas fa-map-location-dot"></i> الانتقال إلى الخريطة</button>`
                : '';

            return `<div class="nms-gallery-card">${mediaHtml}${infoHtml}${actionsHtml}${gotoBtnHtml}</div>`;
        }

        // بطاقة "قبل وبعد" (خدمات فقط - details_link_1 و details_link_2)
        function buildBeforeAfterCardHtml(feature, item) {
            const props = feature.properties || {};
            const name = sanitize(props.name || '');
            const location = sanitize(props.location_name || props.location || '');
            const featureId = (props.id !== undefined && props.id !== null) ? props.id : '';

            const beforeUrl = cleanExternalUrl(props.details_link_1);
            const afterUrl = cleanExternalUrl(props.details_link_2);
            if (!beforeUrl && !afterUrl) return '';

            const mediaHtml = `<div class="nms-before-after-media">
                <div class="nms-ba-col">
                    <span class="nms-ba-label">قبل</span>
                    ${beforeUrl ? renderBeforeAfterMedia(beforeUrl) : '<div class="nms-ba-empty">لا يوجد</div>'}
                </div>
                <div class="nms-ba-col">
                    <span class="nms-ba-label">بعد</span>
                    ${afterUrl ? renderBeforeAfterMedia(afterUrl) : '<div class="nms-ba-empty">لا يوجد</div>'}
                </div>
            </div>`;

            let infoHtml = `<div class="nms-gallery-card-body">`;
            infoHtml += `<div class="nms-gallery-badge">🏆 ${item.label}</div>`;
            infoHtml += getStatusBadge(props.auto_status, props.work_hours);
            if (name) infoHtml += `<div class="nms-r-name"><i class="fas fa-user"></i> ${name}</div>`;
            if (location) infoHtml += `<div class="nms-r-loc"><i class="fas fa-map-marker-alt"></i> ${location}</div>`;
            if (featureId !== '') {
                infoHtml += `<div id="rating-display-${item.layer}-${featureId}" class="nms-rating-display">
                    <span style="color:#f57c00;">⭐</span>
                    <span id="rating-text-${item.layer}-${featureId}" style="color:#666; font-size:12px;">جاري تحميل التقييم...</span>
                </div>`;
                scheduleRatingFetchOnce(item.layer, featureId);
            }
            if (props.des) infoHtml += `<div class="nms-r-desc"><b>📝 الوصف:</b> ${sanitize(props.des)}</div>`;
            infoHtml += `</div>`;

            const actionsHtml = buildGalleryContactActionsHtml(props, item);
            const coords = getFeatureCoords(feature);
            const gotoBtnHtml = coords
                ? `<button type="button" class="nms-goto-map-btn" onclick="window.nmsGotoMapFromCoords(${coords[0]}, ${coords[1]})"><i class="fas fa-map-location-dot"></i> الانتقال إلى الخريطة</button>`
                : '';

            return `<div class="nms-gallery-card nms-before-after-card">${mediaHtml}${infoHtml}${actionsHtml}${gotoBtnHtml}</div>`;
        }

                    // 🆕 عرض كل النتائج ضمن شريط أفقي قابل للسكرول (نفس أسلوب "الأعلى تقييماً"
                // و"موصى بهم" تماماً) - أول 3 عناصر تظهر مباشرة، والباقي يظهر بالسكرول
                // الأفقي، بدون أي مربع بحث
                function renderGalleryScrollRow(gridId, allEntries, buildCardFn) {
                    const grid = document.getElementById(gridId);
                    if (!grid) return;

                    const cardsHtml = allEntries.map(entry => buildCardFn(entry.feature, entry.item)).filter(h => h !== '');
                    grid.innerHTML = cardsHtml.length
                        ? cardsHtml.join('')
                        : '<div class="nms-empty">لا توجد نتائج</div>';
                    wireAdActionButtons(grid);
                }

        // 🆕 تحميل قسم صور أو فيديوهات: فقط المعالم التي تُعتبر "الأعلى تقييماً"
        // (rating = 10 أو 9.9 بنفس منطق باقي أقسام الصفحة) وتملك وسائط حقيقية
        async function loadGallerySection(fieldName, gridId, sectionId, mode, includeRealEstate) {
            const grid = document.getElementById(gridId);
            const section = document.getElementById(sectionId);
            if (!grid || !section) return;

            const targets = categories
                .filter(cat => (cat.isRealEstate && includeRealEstate) || !cat.isRealEstate)
                .map(cat => {
                    const { workspace, layerName, isRealEstate } = getWorkspaceAndName(cat.key);
                    return { layer: layerName, workspace, label: cat.title, isRealEstate };
                });

            let collected = [];
            const batchSize = 10;
            for (let i = 0; i < targets.length; i += batchSize) {
                const batch = targets.slice(i, i + batchSize);
                const promises = batch.map(async (item) => {
                    try {
                        const params = new URLSearchParams({
                            layer: item.layer,
                            workspace: item.workspace,
                            field_0: fieldName,
                            operator_0: 'notempty',
                            value_0: '1',
                            field_1: 'rating',
                            operator_1: '=',
                            value_1: '10',
                            field_2: 'rating',
                            operator_2: '=',
                            value_2: '9.9',
                            conditions_count: '3'
                        });
                        const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
                        if (!response.ok) return [];
                        const data = await response.json();
                        return (data.features || []).map(f => ({ feature: f, item }));
                    } catch (err) {
                        return [];
                    }
                });
                const results = await Promise.all(promises);
                results.forEach(list => { if (list.length) collected.push(...list); });
            }

            const validEntries = collected.filter(entry => galleryEntryHasMedia(entry.feature.properties || {}, mode));

            if (validEntries.length === 0) {
                section.dataset.hasData = '0';
                grid.innerHTML = '';
                refreshHomeSectionsVisibility();
                return;
            }

            section.dataset.hasData = '1';
            renderGalleryScrollRow(gridId, validEntries, (f, it) => buildGalleryDetailCardHtml(f, it, mode));
            refreshHomeSectionsVisibility();
        }

        // 🆕 تحميل قسم "قبل وبعد": خدمات فقط (لا عقارات إطلاقاً)، ويشترط أن
        // يكون rating = 10 أو 9.9، بالإضافة إلى وجود details_link_1 و details_link_2 معاً
        async function loadBeforeAfterSection() {
            const grid = document.getElementById('nms-before-after-grid');
            const section = document.getElementById('nms-before-after-section');
            if (!grid || !section) return;

            // 🆕 استبعاد صريح لطبقات العقارات (شقق الإيجار، شقق البيع، الأراضي)
            // - هذا القسم للخدمات فقط كما طُلب
            const targets = categories.filter(cat => !cat.isRealEstate).map(cat => {
                const { workspace, layerName } = getWorkspaceAndName(cat.key);
                return { layer: layerName, workspace, label: cat.title, isRealEstate: false };
            });

            let collected = [];
            const batchSize = 10;
            for (let i = 0; i < targets.length; i += batchSize) {
                const batch = targets.slice(i, i + batchSize);
                const promises = batch.map(async (item) => {
                    try {
                        const params = new URLSearchParams({
                            layer: item.layer,
                            workspace: item.workspace,
                            field_0: 'details_link_1',
                            operator_0: 'notempty',
                            value_0: '1',
                            field_1: 'details_link_2',
                            operator_1: 'notempty',
                            value_1: '1',
                            field_2: 'rating',
                            operator_2: '=',
                            value_2: '10',
                            field_3: 'rating',
                            operator_3: '=',
                            value_3: '9.9',
                            conditions_count: '4'
                        });
                        const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
                        if (!response.ok) return [];
                        const data = await response.json();
                        return (data.features || []).map(f => ({ feature: f, item }));
                    } catch (err) {
                        return [];
                    }
                });
                const results = await Promise.all(promises);
                results.forEach(list => { if (list.length) collected.push(...list); });
            }

            if (collected.length === 0) {
                section.dataset.hasData = '0';
                grid.innerHTML = '';
                refreshHomeSectionsVisibility();
                return;
            }

            section.dataset.hasData = '1';
            renderGalleryScrollRow('nms-before-after-grid', collected, buildBeforeAfterCardHtml);
            refreshHomeSectionsVisibility();
        }

        // 🆕 دالة عامة للانتقال إلى موقع أي معلم على الخريطة من أزرار البطاقات
        // (نفس منطق goBtn.onclick الموجود بباقي الصفحة، لكن بصيغة onclick داخل HTML)
        window.nmsGotoMapFromCoords = function (x, y) {
            if (x === undefined || y === undefined || x === null || y === null) return;
            window.open(`/original-index.html?x=${Number(x).toFixed(3)}&y=${Number(y).toFixed(3)}`, '_blank');
        };

        async function loadRatedRow(gridId, sectionId, operator, ratingValue) {
            const grid = document.getElementById(gridId);
            const section = document.getElementById(sectionId);
            if (!grid || !section) return;

            const allTargets = categories.map(cat => {
                const { workspace, layerName, isRealEstate } = getWorkspaceAndName(cat.key);
                return { layer: layerName, workspace, label: cat.title, isRealEstate };
            });

            let collected = [];
            const batchSize = 10;
            for (let i = 0; i < allTargets.length; i += batchSize) {
                const batch = allTargets.slice(i, i + batchSize);
                const promises = batch.map(async (item) => {
                    try {
                        const params = new URLSearchParams({
                            layer: item.layer,
                            workspace: item.workspace,
                            field_0: 'rating',
                            operator_0: operator,
                            value_0: String(ratingValue),
                            conditions_count: '1'
                        });
                        const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
                        if (!response.ok) return [];
                        const data = await response.json();
                        const features = data.features || [];
                        return features.map(f => ({
                            props: f.properties || {},
                            item,
                            rating: parseFloat((f.properties || {}).rating) || 0
                        }));
                    } catch (err) {
                        return [];
                    }
                });
                const results = await Promise.all(promises);
                results.forEach(list => { if (list.length) collected.push(...list); });
            }

            collected.sort((a, b) => b.rating - a.rating);

            if (collected.length === 0) {
                section.dataset.hasData = '0';
                grid.innerHTML = '';
                refreshHomeSectionsVisibility();
                return;
            }

            section.dataset.hasData = '1';
            grid.innerHTML = collected.slice(0, 15).map(c => buildAdCardHtml(c.props, c.item)).join('');
            wireAdActionButtons(grid);
            refreshHomeSectionsVisibility();
        }

                // 🆕 قسم "الأعلى تقييماً" الحقيقي: يعتمد على جدول service_ratings الفعلي
    
        async function loadTopRatedFromRealRatings() {
            const grid = document.getElementById('nms-top-rated-grid');
            const section = document.getElementById('nms-top-rated-section');
            if (!grid || !section) return;

            try {
                const res = await fetch(`${baseUrl}api/top-rated-providers?limit=15`);
                const data = await res.json();

                if (!data.success || !data.items || data.items.length === 0) {
                    section.dataset.hasData = '0';
                    grid.innerHTML = '';
                    refreshHomeSectionsVisibility();
                    return;
                }

                                const REAL_ESTATE_TABLE_NAMES = ['ApartRent', 'ApartSale', 'LandSale'];
                const REAL_ESTATE_LABELS = { 'ApartRent': 'شقة للإيجار', 'ApartSale': 'شقة للبيع', 'LandSale': 'أرض للبيع' };

                                const KNOWN_SERVICE_KEYS = Object.keys(serviceNames || {});

                const cardsPromises = data.items.map(async (ratingItem) => {
                    const layerKey = ratingItem.service_layer;
                    const featureId = ratingItem.feature_id;
                    if (!layerKey || !featureId) return null;

                    const isRealEstateLayer = REAL_ESTATE_TABLE_NAMES.includes(layerKey);

                    // 🆕 تجاهل أي سجل تقييم قديم/فاسد يحمل اسم طبقة غير معروف
                    // (مثل تسمية عربية مخزّنة بالخطأ بدل اسم الجدول الحقيقي)
                    if (!isRealEstateLayer && !KNOWN_SERVICE_KEYS.includes(layerKey)) {
                        return null;
                    }

                    const workspaceForLayer = isRealEstateLayer ? 'realestate' : 'services';

                    try {
                        const params = new URLSearchParams({
                            layer: layerKey,
                            workspace: workspaceForLayer,
                            field_0: isRealEstateLayer ? 'fid' : 'id',
                            operator_0: '=',
                            value_0: String(featureId),
                            conditions_count: '1',
                            ignore_status: '1'
                        });
                        const fRes = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
                        if (!fRes.ok) return null;
                        const fData = await fRes.json();
                        const feature = (fData.features || [])[0];
                        if (!feature) return null;

                        const label = isRealEstateLayer ? (REAL_ESTATE_LABELS[layerKey] || layerKey) : (serviceNames[layerKey] || layerKey);
                        const cardItem = {
                            layer: layerKey,
                            workspace: workspaceForLayer,
                            label,
                            isRealEstate: isRealEstateLayer,
                            avgRating: parseFloat(ratingItem.avg_rating) || 0,
                            totalRatings: parseInt(ratingItem.total_ratings, 10) || 0,
                            badgeText: '🏆 الأعلى تقييماً'
                        };
                        return buildAdCardHtml(feature.properties || {}, cardItem);
                    } catch (err) {
                        return null;
                    }
                });

                const cards = (await Promise.all(cardsPromises)).filter(Boolean);

                if (cards.length === 0) {
                    section.dataset.hasData = '0';
                    grid.innerHTML = '';
                    refreshHomeSectionsVisibility();
                    return;
                }

                section.dataset.hasData = '1';
                grid.innerHTML = cards.join('');
                wireAdActionButtons(grid); // 🆕 يضمن تسجيل نقرات اتصال/واتساب/طلب خدمة لهذا القسم أيضاً
                refreshHomeSectionsVisibility();
            } catch (err) {
                console.warn('تعذر جلب قسم الأعلى تقييماً الحقيقي:', err.message);
            }
        }

       
        loadTopRatedFromRealRatings();
        loadRatedRow('nms-recommended-grid', 'nms-recommended-section', '=', 9.9);
        loadFeaturedAds();
        loadGallerySection('pic', 'nms-photos-grid', 'nms-photos-section', 'photo', true);
        loadGallerySection('video', 'nms-videos-grid', 'nms-videos-section', 'video', true);
        loadBeforeAfterSection();



            backBtn.onclick = () => {
            resultsView.classList.add('hidden');
            categoriesView.classList.remove('hidden');
            refreshHomeSectionsVisibility();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        // ==========================================================================
        // 3) الفلاتر
        // ==========================================================================
        let currentCategory = null;
        let allFieldValues = {}; // تخزين جميع القيم لكل حقل للفلترة المحلية
        let currentFilterFields = []; // 🆕 حقول الفئة الحالية (لمعرفة نوع كل حقل عند إعادة التعبئة)

        const fallbackFieldsConfig = {
            realEstate: [
                { id: 'gov_a', name: 'المحافظة', type: 'dropdown' },
                { id: 'village_a', name: 'المدينة/القرية', type: 'dropdown' },
                { id: 'location', name: 'الموقع', type: 'dropdown' },
                { id: 'price', name: 'السعر', type: 'number' },
                { id: 'area', name: 'المساحة', type: 'number' }
            ],
            services: [
                { id: 'gov_a', name: 'المحافظة', type: 'dropdown' },
                { id: 'village_a', name: 'المدينة/القرية', type: 'dropdown' },
                { id: 'location_name', name: 'الموقع', type: 'dropdown' },
                { id: 'name', name: 'الاسم', type: 'dropdown' }
            ]
        };

        const fieldsConfig = window.searchFieldsConfig || fallbackFieldsConfig;

        const filtersGrid = document.getElementById('nms-filters-grid');
        const clearSearchBtn = document.getElementById('nms-clear-search');
        const resultsCountEl = document.getElementById('nms-results-count');
        const resultsListEl = document.getElementById('nms-results-list');

            function openCategory(cat) {
            currentCategory = cat;
            allFieldValues = {}; // إعادة تعيين القيم المخزنة
            categoriesView.classList.add('hidden');
            resultsView.classList.remove('hidden');
            refreshHomeSectionsVisibility();
            categoryTitleEl.innerHTML = `<i class="fas ${cat.icon}"></i> ${cat.title}`;

                        // 🆕 نفس منطق حقول البحث الذكي (search.js): حقل stop لحواجز الطرق،
            // وحقول ديزل/بنزين95/بنزين98 لمحطات الوقود، بدل الحقول العامة فقط
            let fields;
            if (cat.isRealEstate) {
                fields = fieldsConfig.realEstate;
            } else if (cat.key === 'road_barriersLayer' && fieldsConfig.roadBarriers) {
                fields = fieldsConfig.roadBarriers;
            } else if (cat.key === 'fuel_stationsLayer' && fieldsConfig.fuelStations) {
                fields = fieldsConfig.fuelStations;
            } else {
                fields = fieldsConfig.services;
            }
            currentFilterFields = fields; // 🆕 حفظها لاستخدامها لاحقاً عند إعادة تعبئة الحقول التابعة
            renderFiltersGrid(fields);
            executeSearch();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function renderFiltersGrid(fields) {
            filtersGrid.innerHTML = '';
            const { workspace, layerName } = getWorkspaceAndName(currentCategory.key);

            fields.forEach((field, index) => {
                const filterItem = document.createElement('div');
                filterItem.className = 'nms-filter-item';

                const label = document.createElement('label');
                label.textContent = field.name;
                filterItem.appendChild(label);

                                if (field.type === 'dropdown') {
                    const select = document.createElement('select');
                    select.dataset.fieldId = field.id;
                    select.dataset.fieldIndex = index;
                    select.innerHTML = '<option value="">الكل</option>';

                    // جلب القيم المتاحة مع الفلاتر الحالية
                    updateDropdownValues(select, field.id, layerName, workspace);

                    // عند تغيير القيمة، تحديث القوائم التالية وتنفيذ البحث
                    select.addEventListener('change', () => {
                        updateDependentDropdowns(index);
                        executeSearch();
                    });

                    filterItem.appendChild(select);
                } else if (field.type === 'fixedSelect') {
                    // 🆕 قائمة ثابتة بخيارات جاهزة (بدون استعلام سيرفر) - تُستخدم
                    // لحالة الحاجز (stop) وتوفر الوقود (diesel/banzen95/banzen98)
                    const select = document.createElement('select');
                    select.dataset.fieldId = field.id;
                    select.dataset.fieldIndex = index;
                    select.innerHTML = '<option value="">الكل</option>' +
                        (field.options || []).map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');

                    select.addEventListener('change', () => {
                        executeSearch();
                    });

                    filterItem.appendChild(select);
                } else if (field.id === 'price') {
                    // حقل السعر مع اختيار العملة والمقارنة
                    const priceContainer = document.createElement('div');
                    priceContainer.style.display = 'flex';
                    priceContainer.style.gap = '5px';
                    priceContainer.style.flexWrap = 'wrap';

                    const currencySelect = document.createElement('select');
                    currencySelect.dataset.fieldId = 'currency';
                    currencySelect.innerHTML = `
                        <option value="">العملة</option>
                        <option value="USD">دولار ($)</option>
                        <option value="ILS">شيكل (₪)</option>
                        <option value="JOD">دينار (د.أ)</option>
                    `;
                    currencySelect.style.flex = '1';
                    currencySelect.addEventListener('change', debounce(() => executeSearch(), 300));

                    const operatorSelect = document.createElement('select');
                    operatorSelect.dataset.fieldId = `${field.id}_operator`;
                    operatorSelect.innerHTML = `
                        <option value="<">أقل من أو يساوي</option>
                        <option value=">">أكبر من أو يساوي</option>
                    `;
                    operatorSelect.style.flex = '1';
                    operatorSelect.addEventListener('change', debounce(() => executeSearch(), 300));

                    const priceInput = document.createElement('input');
                    priceInput.type = 'number';
                    priceInput.dataset.fieldId = field.id;
                    priceInput.placeholder = 'القيمة';
                    priceInput.style.flex = '1';
                    priceInput.addEventListener('input', debounce(() => executeSearch(), 300));

                    priceContainer.appendChild(currencySelect);
                    priceContainer.appendChild(operatorSelect);
                    priceContainer.appendChild(priceInput);
                    filterItem.appendChild(priceContainer);
                } else if (field.id === 'area') {
                    // حقل المساحة بالمتر المربع مع خيار المقارنة
                    const areaContainer = document.createElement('div');
                    areaContainer.style.display = 'flex';
                    areaContainer.style.gap = '5px';

                    const operatorSelect = document.createElement('select');
                    operatorSelect.dataset.fieldId = `${field.id}_operator`;
                    operatorSelect.innerHTML = `
                        <option value="<">أقل من أو يساوي</option>
                        <option value=">">أكبر من أو يساوي</option>
                    `;
                    operatorSelect.style.flex = '1';
                    operatorSelect.addEventListener('change', debounce(() => executeSearch(), 300));

                    const areaInput = document.createElement('input');
                    areaInput.type = 'number';
                    areaInput.dataset.fieldId = field.id;
                    areaInput.placeholder = 'المساحة (م²)';
                    areaInput.min = '0';
                    areaInput.step = '1';
                    areaInput.style.flex = '2';
                    areaInput.addEventListener('input', debounce(() => executeSearch(), 300));

                    areaContainer.appendChild(operatorSelect);
                    areaContainer.appendChild(areaInput);
                    filterItem.appendChild(areaContainer);
                } else if (field.type === 'text') {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.dataset.fieldId = field.id;
                    input.placeholder = field.name;
                    input.addEventListener('input', debounce(() => executeSearch(), 300));
                    filterItem.appendChild(input);
                } else if (field.type === 'number') {
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.dataset.fieldId = field.id;
                    input.placeholder = field.name;
                    input.addEventListener('input', debounce(() => executeSearch(), 300));
                    filterItem.appendChild(input);
                }

                filtersGrid.appendChild(filterItem);
            });
        }

        function updateDropdownValues(select, fieldId, layerName, workspace) {
            // للمواقع والأسماء: استخدام الفلترة المحلية
            if (fieldId === 'location' || fieldId === 'location_name' || fieldId === 'name') {
                filterDropdownLocally(select, fieldId);
                return;
            }

            // للمحافظة والمدن: استخدام السيرفر
            const params = new URLSearchParams({ layer: layerName, workspace, field: fieldId });

            // إضافة الفلاتر فقط من القوائم السابقة التي تم اختيارها (ليست فارغة)
            const filterItems = filtersGrid.querySelectorAll('.nms-filter-item');
            filterItems.forEach(item => {
                const currentSelect = item.querySelector('select');
                if (currentSelect && currentSelect.value && currentSelect.dataset.fieldId !== fieldId) {
                    params.append(`filter_${currentSelect.dataset.fieldId}`, currentSelect.value);
                }
            });

            fetch(`${baseUrl}api/get-unique-values?${params.toString()}`)
                .then(res => res.json())
                .then(data => {
                    const currentValue = select.value;
                    select.innerHTML = '<option value="">الكل</option>';

                    if (data.success && data.values && data.values.length > 0) {
                        data.values.sort().forEach(value => {
                            const option = document.createElement('option');
                            option.value = value;
                            option.textContent = value;
                            select.appendChild(option);
                        });
                        select.value = currentValue;

                        // تخزين القيم للفلترة المحلية
                        allFieldValues[fieldId] = data.values;
                    } else {
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = 'لا توجد قيم';
                        option.disabled = true;
                        select.appendChild(option);
                    }
                })
                .catch(() => {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'خطأ في جلب البيانات';
                    option.disabled = true;
                    select.appendChild(option);
                });
        }

        function filterDropdownLocally(select, fieldId) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">الكل</option>';

            // جلب القيم المخزنة أو جلبها من السيرفر إذا لم تكن موجودة
            if (!allFieldValues[fieldId]) {
                const { workspace, layerName } = getWorkspaceAndName(currentCategory.key);
                fetch(`${baseUrl}api/get-unique-values?layer=${layerName}&workspace=${workspace}&field=${fieldId}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.values) {
                            allFieldValues[fieldId] = data.values;
                            filterDropdownLocally(select, fieldId);
                        }
                    });
                return;
            }

            const values = allFieldValues[fieldId];
            const govValue = getFilterValue('gov_a');
            const villageValue = getFilterValue('village_a');

            // فلترة القيم بناءً على المحافظة والمدينة
            const filteredValues = values.filter(value => {
                // إذا لم يتم اختيار محافظة أو مدينة، عرض كل القيم
                if (!govValue && !villageValue) return true;

                // فلترة بناءً على المحافظة
                if (govValue && value.includes(govValue.replace('محافظة ', ''))) return true;

                // فلترة بناءً على المدينة
                if (villageValue && value.includes(villageValue)) return true;

                return false;
            });

            filteredValues.sort().forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });

            select.value = currentValue;
        }

        function getFilterValue(fieldId) {
            const filterItems = filtersGrid.querySelectorAll('.nms-filter-item');
            for (const item of filterItems) {
                const select = item.querySelector('select');
                const input = item.querySelector('input');

                if (fieldId === 'currency') {
                    // البحث عن select العملة
                    const currencySelect = item.querySelector('select[data-field-id="currency"]');
                    if (currencySelect && currencySelect.value) {
                        return currencySelect.value;
                    }
                } else if (select && select.dataset.fieldId === fieldId && select.value) {
                    return select.value;
                } else if (input && input.dataset.fieldId === fieldId && input.value) {
                    return input.value;
                }
            }
            return null;
        }

            function updateDependentDropdowns(changedIndex) {
            const filterItems = filtersGrid.querySelectorAll('.nms-filter-item');
            const { workspace, layerName } = getWorkspaceAndName(currentCategory.key);

            filterItems.forEach((item, index) => {
                if (index > changedIndex) {
                    const select = item.querySelector('select');
                    if (!select) return;

                    // 🆕 [إصلاح حاسم]: الحقول الثابتة (fixedSelect) مثل "حالة الحاجز"
                    // أو "توفر الوقود" لها قيم جاهزة ومعروفة سلفاً (لا تُجلب من قاعدة
                    // البيانات إطلاقاً)، فيجب عدم لمسها أو إعادة تعبئتها هنا مطلقاً.
                    // كانت هذه الدالة تعاملها كحقل عادي وتستبدل تسمياتها (🟢 مفتوح...)
                    // بالقيم الرقمية الخام من قاعدة البيانات (0،1،2...) عند تفعيل أي
                    // فلتر متسلسل قبلها (مثل المحافظة أو المدينة).
                    const fieldDef = currentFilterFields[index];
                    if (fieldDef && fieldDef.type === 'fixedSelect') {
                        return;
                    }

                    select.value = ''; // إعادة تعيين القيمة
                    updateDropdownValues(select, select.dataset.fieldId, layerName, workspace);
                }
            });
        }

        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // إزالة الكود القديم غير المستخدم

        clearSearchBtn.onclick = () => {
            const filterItems = filtersGrid.querySelectorAll('.nms-filter-item');
            filterItems.forEach(filterItem => {
                const select = filterItem.querySelector('select');
                const input = filterItem.querySelector('input');

                if (select) select.value = '';
                if (input) input.value = '';
            });
            executeSearch();
        };

        async function executeSearch() {
            resultsListEl.innerHTML = '<div class="nms-loading"><i class="fas fa-spinner fa-spin"></i> جاري البحث...</div>';
            resultsCountEl.textContent = '';

            // 🆕 فحص حد الطلبات وتسجيله قبل تنفيذ البحث - يمنع التنفيذ فوراً عند التجاوز
            if (window.checkAndLogMapEvent) {
                const quotaCheck = await window.checkAndLogMapEvent('no_map_search', null, currentCategory.title);
                if (!quotaCheck.allowed) {
                    resultsListEl.innerHTML = '';
                    resultsCountEl.textContent = '';
                    return;
                }
            }

            const { workspace, layerName, isRealEstate } = getWorkspaceAndName(currentCategory.key);
            const params = new URLSearchParams({ layer: layerName, workspace });

            // قراءة القيم من الفلاتر الجديدة
            const filterItems = filtersGrid.querySelectorAll('.nms-filter-item');
            let conditionIndex = 0;

            filterItems.forEach(filterItem => {
                const selects = filterItem.querySelectorAll('select');
                const input = filterItem.querySelector('input');

                // معالجة select العادية (المحافظة، المدينة، إلخ)
                selects.forEach(select => {
                    if (select.value && !select.dataset.fieldId.includes('_operator') && select.dataset.fieldId !== 'currency') {
                        params.append(`field_${conditionIndex}`, select.dataset.fieldId);
                        params.append(`operator_${conditionIndex}`, '=');
                        params.append(`value_${conditionIndex}`, select.value);
                        conditionIndex++;
                    }
                });

                // معالجة العملة
                const currencySelect = filterItem.querySelector('select[data-field-id="currency"]');
                if (currencySelect && currencySelect.value) {
                    params.append(`field_${conditionIndex}`, 'currency');
                    params.append(`operator_${conditionIndex}`, '=');
                    params.append(`value_${conditionIndex}`, currencySelect.value);
                    conditionIndex++;
                }

                // معالجة حقول السعر والمساحة
                if (input && input.value) {
                    const fieldId = input.dataset.fieldId;
                    const value = input.value;

                    if (fieldId === 'price' || fieldId === 'area') {
                        // جلب operator المختار
                        const operatorSelect = filterItem.querySelector(`select[data-field-id="${fieldId}_operator"]`);
                        const operator = operatorSelect ? operatorSelect.value : '<';

                        params.append(`field_${conditionIndex}`, fieldId);
                        params.append(`operator_${conditionIndex}`, operator);
                        params.append(`value_${conditionIndex}`, value);
                        conditionIndex++;
                    } else {
                        // للحقول النصية الأخرى
                        params.append(`field_${conditionIndex}`, fieldId);
                        params.append(`operator_${conditionIndex}`, 'contains');
                        params.append(`value_${conditionIndex}`, value);
                        conditionIndex++;
                    }
                }
            });

            if (conditionIndex > 0) params.append('conditions_count', conditionIndex);

            try {
                const res = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
                const data = await res.json();
                renderResults(data.features || [], currentCategory.title, isRealEstate);
            } catch (err) {
                resultsListEl.innerHTML = '<div class="nms-empty">حدث خطأ أثناء الاتصال بالسيرفر، يرجى المحاولة لاحقاً.</div>';
            }
        }

        // ==========================================================================
        // 4) عرض النتائج
        // ==========================================================================
        function formatWorkHours(workHours) {
            if (!workHours || workHours.trim() === '' || workHours === '00:00-23:59') return 'دوام 24 ساعة';
            return workHours;
        }

        function getStatusBadge(autoStatus, workHours) {
            const isAvailable = parseInt(autoStatus) === 0;
            const color = isAvailable ? '#28a745' : '#dc3545';
            const text = isAvailable ? 'متاح الآن' : 'مغلق حالياً';
            const icon = isAvailable ? '🟢' : '🔴';
            return `<div class="nms-status-badge" style="color:${color}; border-color:${color};">
                        ${icon} ${text}
                        <span class="nms-status-hours">${formatWorkHours(workHours)}</span>
                    </div>`;
        }

        function polygonCentroid(ring) {
            try {
                let x = 0, y = 0;
                ring.forEach(pt => { x += pt[0]; y += pt[1]; });
                return [x / ring.length, y / ring.length];
            } catch (e) { return null; }
        }

        function getFeatureCoords(feature) {
            const geom = feature.geometry;
            if (!geom) return null;
            if (geom.type === 'Point') return geom.coordinates;
            if (geom.type === 'Polygon') return polygonCentroid(geom.coordinates[0]);
            if (geom.type === 'MultiPolygon') return polygonCentroid(geom.coordinates[0][0]);
            return null;
        }

        function sanitize(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        function renderResults(features, layerTitle, isRealEstate) {
            resultsCountEl.textContent = `عدد النتائج: ${features.length}`;
            if (features.length === 0) {
                resultsListEl.innerHTML = '<div class="nms-empty"><i class="fas fa-face-frown"></i> لا توجد نتائج مطابقة حالياً.</div>';
                return;
            }

            features = features.slice().sort((a, b) => (parseFloat(b.properties.rating) || 0) - (parseFloat(a.properties.rating) || 0));

                        resultsListEl.innerHTML = '';
            const isRoadBarriers = currentCategory && currentCategory.key === 'road_barriersLayer';

            features.forEach((f, index) => {
                const p = f.properties;
                const coords = getFeatureCoords(f);
                const card = document.createElement('div');
                card.className = 'nms-result-card';
                card.style.setProperty('--i', Math.min(index, 20));

                // 🆕 حواجز الطرق: قالب مستقل بالكامل (حالة Stop + الاسم + المحافظة/المدينة/الموقع + زر الانتقال)
                if (isRoadBarriers) {
                    const stopInfo = window.getRoadBarrierStopInfo(p.stop !== undefined ? p.stop : p.stop);
                    let barrierHtml = `<div style="text-align:center; font-weight:bold; font-size:14px; color:${stopInfo.color}; border:1px dashed ${stopInfo.color}; border-radius:8px; padding:8px; margin-bottom:8px; background:${stopInfo.color}15;">${stopInfo.icon} ${stopInfo.label}</div>`;
                    if (p.name) barrierHtml += `<div class="nms-r-name"><i class="fas fa-map-marker-alt"></i> ${sanitize(p.name)}</div>`;
                    if (p.gov_a) barrierHtml += `<div class="nms-r-line"><b>🌍 المحافظة:</b> ${sanitize(p.gov_a)}</div>`;
                    if (p.village_a) barrierHtml += `<div class="nms-r-line"><b>🏘️ المدينة:</b> ${sanitize(p.village_a)}</div>`;
                    if (p.location_name || p.location) barrierHtml += `<div class="nms-r-line"><b>📍 الموقع:</b> ${sanitize(p.location_name || p.location)}</div>`;
                    card.innerHTML = barrierHtml;

                    if (coords) {
                        const goBtn = document.createElement('button');
                        goBtn.className = 'nms-goto-map-btn';
                        goBtn.innerHTML = '<i class="fas fa-map-location-dot"></i> الانتقال إلى الخريطة';
                        goBtn.onclick = () => {
                            window.open(`/original-index.html?x=${coords[0].toFixed(3)}&y=${coords[1].toFixed(3)}`, '_blank');
                        };
                        card.appendChild(goBtn);
                    }

                    resultsListEl.appendChild(card);
                    return; // تخطي بقية منطق الكرت القياسي (تقييم، وصف، اتصال...)
                }

                let html = '';
                if (!isRealEstate) html += getStatusBadge(p.auto_status, p.work_hours);
                if (p.name) html += `<div class="nms-r-name"><i class="fas fa-user"></i> ${sanitize(p.name)}</div>`;
                if (p.location_name || p.location) html += `<div class="nms-r-loc"><i class="fas fa-map-marker-alt"></i> ${sanitize(p.location_name || p.location)}</div>`;

                if (layerTitle === 'محطات الوقود') {
                    html += window.buildFuelAvailabilityHtml(p);
                }

                // إضافة عرض النجوم للخدمات فقط
                if (!isRealEstate) {
                    // استخدام layerTitle مباشرة لأنه هو الاسم المستخدم في قاعدة البيانات
                    const layerDbName = layerTitle;
                    const featureId = (p.id !== undefined && p.id !== null) ? p.id : '';
                    if (layerDbName && featureId) {
                        html += `<div id="rating-display-${layerDbName}-${featureId}" class="nms-rating-display">
                            <span style="color: #f57c00;">⭐</span>
                            <span id="rating-text-${layerDbName}-${featureId}" style="color: #666; font-size: 12px;">جاري تحميل التقييم...</span>
                        </div>`;
                        
                        // جلب التقييم بشكل غير متزامن
                        setTimeout(() => fetchRatingsForFeature(layerDbName, featureId), index * 100);
                    }
                }

                if (isRealEstate) {
                    if (p.price) {
                        const symbols = { USD: 'دولار', ILS: 'شيقل', JOD: 'دينار' };
                        const sym = symbols[p.currency] || '';
                        html += `<div class="nms-r-line"><b>💰 السعر:</b> ${Number(p.price).toLocaleString()} ${sym}</div>`;
                    }
                    if (p.area) html += `<div class="nms-r-line"><b>📐 المساحة:</b> ${p.area} م²</div>`;
                    if (p.village_a) html += `<div class="nms-r-line"><b>🏘️ البلدة:</b> ${sanitize(p.village_a)}</div>`;
                    if (p.gov_a) html += `<div class="nms-r-line"><b>🌍 المحافظة:</b> ${sanitize(p.gov_a)}</div>`;
                }
                if (p.des) html += `<div class="nms-r-desc"><b>📝 الوصف:</b> ${sanitize(p.des)}</div>`;
                if (p.pic) html += `<div class="nms-r-img"><img src="${p.pic}" onerror="this.parentElement.style.display='none'"></div>`;
                if (p.video) {
                    const videoUrl = p.video.toString().trim().startsWith('http') ? p.video : 'https://' + p.video;
                    html += `<div style="margin-top:6px;"><a href="${videoUrl}" target="_blank" rel="noopener" style="color:#1a73e8; font-weight:bold; text-decoration:none; display:inline-flex; align-items:center; gap:5px; font-size:12px;"><i class="fas fa-video"></i> عرض الفيديو</a></div>`;
                }

                card.innerHTML = html;

                if (p.whatsapp) {
                    const whatsappNumber = p.whatsapp.toString();
                    // 🆕 استخدام قيمة phone مباشرة إذا كانت موجودة، وإلا التحويل من whatsapp
                    const localPhone = p.phone ? p.phone.toString() : ('0' + whatsappNumber.replace(/\D/g, '').slice(5));
                    const providerName = p.name || (isRealEstate ? 'المعلن' : 'مزود الخدمة');

                    // 🆕 [عرض ذكي حسب ارتباط الخدمة بحساب مزود فعلي]: العقارات دائماً
                    // اتصال+واتساب. الخدمات: "طلب الخدمة" فقط إذا كان المعلم مرتبطاً
                    // فعلياً بحساب مزود مُفعّل، وإلا اتصال+واتساب مباشرة مثل العقارات.
                    const layerDbName = (currentCategory.key || '').replace(/Layer$/i, '');
                    const featureIdForRequest = isRealEstate
                        ? ((p.fid !== undefined && p.fid !== null) ? p.fid : '')
                        : ((p.id !== undefined && p.id !== null) ? p.id : '');
                    const isLinkedProvider = !isRealEstate && typeof window.isFeatureLinkedToProvider === 'function' && window.isFeatureLinkedToProvider(layerDbName, featureIdForRequest);

                                    if (isLinkedProvider) {
                    // 🆕 [نظام طلب الخدمة]: بديل موحّد عن الاتصال/الواتساب المباشرين -
                    // زر واحد يرسل طلباً حقيقياً لحساب مزود الخدمة (راجع service-chat.js)
                    const actions = document.createElement('div');
                    actions.className = 'nms-r-actions';
                    actions.innerHTML = `
                        <button class="req-svc-btn" style="flex:1;" data-provider="${providerName.replace(/"/g, '&quot;')}" data-service="${layerTitle.replace(/"/g, '&quot;')}" data-layer="${layerDbName}" data-feature-id="${featureIdForRequest}">
                            <i class="fas fa-paper-plane"></i> طلب الخدمة
                        </button>
                    `;
                    card.appendChild(actions);
                } else {
                                        // 🆕 زر الاتصال يظهر فقط إذا كان هناك phone
                    const hasPhone = p.phone !== undefined && p.phone !== null && p.phone !== '' && String(p.phone).trim() !== '';
                    const actions = document.createElement('div');
                    actions.className = 'nms-r-actions';
                    actions.innerHTML = `
                        ${hasPhone ? `<button class="nms-call-btn"><i class="fas fa-mobile-alt"></i> اتصال <span dir="ltr">${sanitize(localPhone)}</span></button>` : ''}
                        <button class="nms-whatsapp-btn"><i class="fab fa-whatsapp"></i> واتساب</button>
                    `;
                    if (hasPhone) {
                        actions.querySelector('.nms-call-btn').onclick = async () => {
                            const quota = await checkRequestQuotaOrAlert(getRealUserId(), null);
                            if (!quota.allowed) return;
                            // 🆕 تسجيل نقرة الاتصال في نظام لوحة التحكم (service_requests)
                            // بنفس طريقة market-search.js وpopup.js تماماً، لضمان ظهورها
                            // في dashboard.html مع الاسم الحقيقي لمزود الخدمة
                            try {
                                await fetch(window.location.origin + '/api/log-contact-click', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        user_id: getRealUserId(),
                                        service_layer: layerDbName,
                                        feature_id: featureIdForRequest,
                                        provider_name: providerName,
                                        contact_type: 'call'
                                    })
                                });
                            } catch (err) {
                                console.error('خطأ في تسجيل نقرة الاتصال:', err);
                            }
                            trackRequest(providerName, `(${layerTitle}) اتصال مباشر`);
                            window.location.href = 'tel:' + localPhone;
                        };
                    }
                    actions.querySelector('.nms-whatsapp-btn').onclick = async () => {
                        const newTab = window.open('', '_blank');
                        const quota = await checkRequestQuotaOrAlert(getRealUserId(), newTab);
                        if (!quota.allowed) return;
                        // 🆕 تسجيل نقرة الواتساب في نظام لوحة التحكم (service_requests)
                        try {
                            await fetch(window.location.origin + '/api/log-contact-click', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    user_id: getRealUserId(),
                                    service_layer: layerDbName,
                                    feature_id: featureIdForRequest,
                                    provider_name: providerName,
                                    contact_type: 'whatsapp'
                                })
                            });
                        } catch (err) {
                            console.error('خطأ في تسجيل نقرة الواتساب:', err);
                        }
                        trackRequest(providerName, `(${layerTitle}) واتساب`);
                        const message = `مرحباً ${providerName}، أرغب بالاستفسار عن (${layerTitle}) من خلال منصة الخدمات.`;
                        let cleanNumber = whatsappNumber.replace(/\D/g, '');
                        if (cleanNumber.startsWith('00')) cleanNumber = cleanNumber.substring(2);
                        const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(message)}`;
                        if (newTab) {
                            newTab.location.href = whatsappUrl;
                        } else {
                            window.open(whatsappUrl, '_blank');
                        }
                    };
                    card.appendChild(actions);
                }
                }

                if (coords) {
                    const goBtn = document.createElement('button');
                    goBtn.className = 'nms-goto-map-btn';
                    goBtn.innerHTML = '<i class="fas fa-map-location-dot"></i> الانتقال إلى الخريطة';
                    goBtn.onclick = () => {
                        // فتح الخريطة في تبويب جديد
                        window.open(`/original-index.html?x=${coords[0].toFixed(3)}&y=${coords[1].toFixed(3)}`, '_blank');
                    };
                    card.appendChild(goBtn);
                }

                resultsListEl.appendChild(card);
            });
        }

        function trackRequest(provider, service) {
            const payload = JSON.stringify({ user_id: getRealUserId(), provider, service });
            const url = baseUrl + 'save-stat';
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
            } else {
                fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
            }
        }

        // خريطة تحويل الأسماء العربية إلى الإنجليزية للطبقات
        const arabicToEnglishLayerMap = {
            'فني كهرباء': 'electrician',
            'فني تكييف وتبريد': 'ac_technician',
            'سباك (مواسيرجي)': 'plumber',
            'صيانة عامة': 'general_maintenance',
            'دهان/طراشة': 'painter',
            'فني ديكور': 'Finisher',
            'نجار': 'carpenter',
            'حداد': 'blacksmith',
            'بناء ومعمار': 'builder',
            'خدمات تنظيف': 'house_cleaner',
            'فني ألمنيوم': 'aluminum_tech',
            'فني زجاج وسكريت': 'glass_tech',
            'ميكانيكي سيارات': 'car_mechanic',
            'كهربائي سيارات': 'car_electrician',
            'بنشري / إطارات': 'tire_tech',
            'غسيل سيارات': 'car_wash',
            'صيانة دراجات نارية': 'motorcycle_repair',
            'مكتب تاكسي': 'taxi_driver',
            'خدمات توصيل': 'delivery_services',
            'ونش إنقاذ': 'tow_truck',
            'فني كاميرات مراقبة': 'cctv_installer',
            'منظم حفلات': 'party_planner',
            'فرقة زفة': 'zaffa_bands',
            'فرق موسيقية': 'music_bands',
            'تأجير مستلزمات حفلات': 'party_rental',
            'تمريض منزلي': 'home_nursing',
            'أخصائي مساج': 'massage_therapist',
            'أخصائي حجامة': 'hijama_specialist',
            'أخصائي تغذية': 'nutritionist',
            'سائق شاحنة': 'truck_driver',
            'شركات أمن وحراسة': 'security_companies',
            'شراء أثاث مستعمل': 'used_furniture_buyer',
            'تنسيق حدائق': 'gardener',
            'رعاية حيوانات أليفة': 'pet_care',
            'مهرج وعروض أطفال': 'clown_entertainer',
            'متاجر أون لاين': 'online_stores',
            'فلل أجار': 'villas_rent',
            'فنون قتالية وجمباز': 'martial_arts_gymnastics',
            'حدائق ومناطق ترفيهية': 'public_parks_recreation',
            'فنادق': 'hotels',
            'توزيع أغراض مجاناً': 'free_distribution',
            'حلاقة شباب': 'barber_shop',
            'مصور فوتوغرافي': 'photographers',
            'تصميم فيديو إعلاني': 'video_design_ads',
            'صيدليات مناوبة': 'pharmacies_on_call',
            'تكاسي نظام مناوبة': 'taxis_on_call',
            'طوارئ ومستشفيات': 'emergency_hospitals',
            'عيادات': 'clinics',
            'دكاترة مناوبة': 'doctors_on_call',
            'إسعاف مناوبة': 'ambulance_on_call',
            'تدريب موسيقى ومعاهد': 'music_training',
            'محاميين': 'lawyers',
            'مساحين أراضي': 'land_surveyors',
            'مخمنين عقاريين': 'real_estate_valuers',
            'أساتذة خصوصي': 'private_tutors',
            'مبرمجين': 'programmers',
            'دليفري سيارات (مناوبة)': 'car_delivery_on_call',
            'دليفري دراجات (مناوبة)': 'motorcycle_delivery_on_call',
            'دليفري هوائية (مناوبة)': 'bicycle_delivery_on_call',
            'مساعد أبحاث طلاب': 'student_research_assist',
            'محطات الوقود': 'fuel_stations',
            'حواجز الطرق': 'road_barriers'
        };

        // دالة جلب التقييمات لمزود خدمة معين
        async function fetchRatingsForFeature(serviceLayer, featureId) {
            try {
                // تحويل الاسم العربي إلى الإنجليزي
                const englishLayerName = arabicToEnglishLayerMap[serviceLayer] || serviceLayer;
                
                const response = await fetch(`${window.location.origin}/api/service-ratings?service_layer=${englishLayerName}&feature_id=${featureId}`);
                const data = await response.json();
                
                if (data.success) {
                    const ratingElement = document.getElementById(`rating-text-${serviceLayer}-${featureId}`);
                    const ratingContainer = document.getElementById(`rating-display-${serviceLayer}-${featureId}`);
                    
                    if (ratingElement && ratingContainer) {
                        if (data.totalRatings > 0) {
                            const stars = '★'.repeat(Math.round(data.averageRating)) + '☆'.repeat(5 - Math.round(data.averageRating));
                            ratingElement.innerHTML = `<span style="color: #ffc107; font-size: 14px;">${stars}</span> <span style="color: #333; font-weight: bold;">${data.averageRating}</span> <span style="color: #666;">(${data.totalRatings} تقييم)</span>`;
                            
                            // التحقق من عدم وجود زر التعليقات مسبقاً
                            let commentsButton = document.getElementById(`comments-btn-${serviceLayer}-${featureId}`);
                            if (!commentsButton) {
                                // إضافة زر لعرض التعليقات
                                const button = document.createElement('button');
                                button.id = `comments-btn-${serviceLayer}-${featureId}`;
                                button.onclick = () => toggleComments(serviceLayer, featureId);
                                button.style.cssText = 'margin-top: 6px; padding: 4px 8px; background: #1a73e8; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
                                button.innerHTML = `💬 عرض التعليقات (${data.totalRatings})`;
                                ratingContainer.appendChild(button);
                                
                                // إضافة حاوية التعليقات
                                const commentsDiv = document.createElement('div');
                                commentsDiv.id = `comments-container-${serviceLayer}-${featureId}`;
                                commentsDiv.style.cssText = 'display: none; margin-top: 8px; max-height: 180px; overflow-y: auto; border-top: 1px solid #eee; padding-top: 6px;';
                                ratingContainer.appendChild(commentsDiv);
                            }
                            
                            // تخزين التقييمات لاستخدامها عند فتح التعليقات
                            window.currentRatings = window.currentRatings || {};
                            window.currentRatings[`${serviceLayer}-${featureId}`] = data.ratings;
                        } else {
                            ratingElement.innerHTML = '<span style="color: #999;">لا توجد تقييمات بعد</span>';
                        }
                    }
                }
            } catch (err) {
                console.warn('فشل جلب التقييمات:', err.message);
            }
        }

        // دالة عرض/إخفاء التعليقات
        window.toggleComments = function(serviceLayer, featureId) {
            const container = document.getElementById(`comments-container-${serviceLayer}-${featureId}`);
            if (!container) return;
            
            if (container.style.display === 'none') {
                container.style.display = 'block';
                const ratings = window.currentRatings?.[`${serviceLayer}-${featureId}`] || [];
                
                if (ratings.length === 0) {
                    container.innerHTML = '<div style="color: #999; font-size: 12px;">لا توجد تعليقات</div>';
                } else {
                    container.innerHTML = ratings.map(r => `
                        <div style="padding: 6px; background: #f9f9f9; border-radius: 4px; margin-bottom: 6px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-weight: bold; font-size: 12px; color: #333;">${r.user_name || 'مستخدم'}</span>
                                <span style="color: #ffc107; font-size: 13px;">${'★'.repeat(r.rating)}</span>
                            </div>
                            ${r.comment ? `<div style="font-size: 12px; color: #666; line-height: 1.4;">${r.comment}</div>` : ''}
                            <div style="font-size: 10px; color: #999; margin-top: 4px;">${new Date(r.created_at).toLocaleDateString('ar-EG')}</div>
                        </div>
                    `).join('');
                }
            } else {
                container.style.display = 'none';
            }
        };

        // قراءة معامل group من رابط الصفحة وتفعيل الفلتر تلقائياً
        const urlParams = new URLSearchParams(window.location.search);
        const targetGroup = urlParams.get('group');
        if (targetGroup) {
            // العثور على زر التبويب المطابق وتفعيل الضغط عليه برمجياً
            setTimeout(() => {
                const groupTabBtn = document.querySelector(`.nms-group-tab[data-group="${targetGroup}"]`) || 
                                       document.querySelector(`#nms-groups-tabs [data-group="${targetGroup}"]`);
                if (groupTabBtn) {
                    groupTabBtn.click();
                } else if (typeof filterByCategoryGroup === 'function') {
                    filterByCategoryGroup(targetGroup);
                }
            }, 300);
        }
    });
})();
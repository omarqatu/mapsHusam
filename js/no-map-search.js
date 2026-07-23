/**
 * js/no-map-search.js
 * صفحة "البحث بدون خريطة" - بديل خفيف وسريع عن الخريطة التفاعلية.
 *
 * التزامن مع search.js:
 * هذا الملف يقرأ حقول الفلترة من window.searchFieldsConfig (المُصدَّرة من js/search.js).
 * أي تعديل مستقبلي على الحقول داخل search.js (إضافة/حذف/تغيير تسمية) ينعكس هنا تلقائياً
 * بدون الحاجة لتعديل هذا الملف، طالما تم تحميل js/search.js قبل هذا السكربت في الصفحة.
 */

(function () {
    
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {

        const baseUrl = window.location.origin + '/';

        // ==========================================================================
        // 🆕 مساعدات مشتركة: هوية المستخدم الحالي + فحص حد الطلبات، أصبحتا معرّفتين
        // مرة واحدة فقط بملف shared-utils.js (window.getRealUserId و
        // window.checkRequestQuotaOrAlert) بدل تكرارهما هنا. يجب تحميل
        // shared-utils.js قبل هذا الملف في الصفحة.
        // ==========================================================================
        const getRealUserId = window.getRealUserId;
        const checkRequestQuotaOrAlert = window.checkRequestQuotaOrAlert;

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
                'pic/Picture2.jpg', 'pic/Picture5.jpg', 'pic/Picture8.jpg',
                'pic/Picture11.jpg', 'pic/Picture14.jpg', 'pic/غلاف1.png'
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
            'student_research_assist': 'fa-book'
        };

        const serviceNames = {
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
            'student_research_assist': 'مساعد أبحاث طلاب'
        };

        const globalExclusions = [];

        // ==========================================================================
        // تصنيف الفروع (التبويبات): كل خدمة أو عقار يتبع فرعاً واحداً لتسهيل الفلترة.
        // العرض الافتراضي "الكل" يبقى يعرض كافة الـ 62 فئة كما هو معتاد.
        // ==========================================================================
        const groupDefs = [
            { id: 'all',           title: 'الكل',                    icon: 'fa-border-all' },
            { id: 'realestate',    title: 'العقارات',                icon: 'fa-building' },
            { id: 'technicians',   title: 'الفنيين والصيانة',        icon: 'fa-tools' },
            { id: 'health',        title: 'الصحة والرعاية',          icon: 'fa-briefcase-medical' },
            { id: 'vehicles',      title: 'المركبات والتوصيل',       icon: 'fa-car' },
            { id: 'professional',  title: 'المهن الحرة والخصوصي',    icon: 'fa-user-tie' },
            { id: 'events',        title: 'مناسبات وضيافة وترفيه',   icon: 'fa-champagne-glasses' },
            { id: 'misc',          title: 'متفرقات',                 icon: 'fa-ellipsis' }
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
            online_stores: 'misc', free_distribution: 'misc'
        };

        const categories = [
            { key: 'rentLayer', title: 'شقق الإيجار', icon: iconMap['rentLayer'], isRealEstate: true, group: 'realestate' },
            { key: 'saleLayer', title: 'شقق للبيع', icon: iconMap['saleLayer'], isRealEstate: true, group: 'realestate' },
            { key: 'landLayer', title: 'الأراضي للبيع', icon: iconMap['landLayer'], isRealEstate: true, group: 'realestate' }
        ];

        Object.keys(serviceNames).forEach(key => {
            if (globalExclusions.includes(key)) return;
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
                    renderCategoriesGrid(activeGroup);
                    categoriesGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                };
                groupsTabsEl.appendChild(tab);
            });
        }

        renderGroupsTabs();
        renderCategoriesGrid(activeGroup); // العرض الافتراضي: الكل (62 فئة)

        backBtn.onclick = () => {
            resultsView.classList.add('hidden');
            categoriesView.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        // ==========================================================================
        // 3) الفلاتر
        // ==========================================================================
        let currentCategory = null;
        let conditions = [];

        const fallbackFieldsConfig = {
            realEstate: [
                { id: 'village_a', name: 'المدينة/القرية', type: 'dropdown' },
                { id: 'gov_a', name: 'المحافظة', type: 'dropdown' },
                { id: 'location', name: 'الموقع', type: 'text' },
                { id: 'price', name: 'السعر', type: 'number' },
                { id: 'area', name: 'المساحة', type: 'number' }
            ],
            services: [
                { id: 'village_a', name: 'المدينة/القرية', type: 'dropdown' },
                { id: 'gov_a', name: 'المحافظة', type: 'dropdown' },
                { id: 'location_name', name: 'الموقع', type: 'text' },
                { id: 'name', name: 'الاسم', type: 'text' }
            ]
        };

        const fieldsConfig = window.searchFieldsConfig || fallbackFieldsConfig;

        const fieldSelect = document.getElementById('nms-field-select');
        const operatorSelect = document.getElementById('nms-operator-select');
        const valueContainer = document.getElementById('nms-value-container');
        const addConditionBtn = document.getElementById('nms-add-condition');
        const conditionsList = document.getElementById('nms-conditions-list');
        const runSearchBtn = document.getElementById('nms-run-search');
        const clearSearchBtn = document.getElementById('nms-clear-search');
        const resultsCountEl = document.getElementById('nms-results-count');
        const resultsListEl = document.getElementById('nms-results-list');

        function openCategory(cat) {
            currentCategory = cat;
            conditions = [];
            categoriesView.classList.add('hidden');
            resultsView.classList.remove('hidden');
            categoryTitleEl.innerHTML = `<i class="fas ${cat.icon}"></i> ${cat.title}`;

            const fields = cat.isRealEstate ? fieldsConfig.realEstate : fieldsConfig.services;
            fieldSelect.innerHTML = fields.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
            renderConditions();
            updateValueUI();
            executeSearch();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        fieldSelect.onchange = updateValueUI;

        function updateValueUI() {
            valueContainer.innerHTML = '<div class="nms-value-loading">جاري تحميل القيم...</div>';
            const fieldId = fieldSelect.value;
            const { workspace, layerName } = getWorkspaceAndName(currentCategory.key);

            fetch(`${baseUrl}api/get-unique-values?${new URLSearchParams({ layer: layerName, workspace, field: fieldId })}`)
                .then(res => res.json())
                .then(data => renderValueSelect((data.success && data.values) ? data.values.sort() : []))
                .catch(() => renderValueSelect([]));
        }

        // 🆕 دالة موحّدة لإضافة قائمة اختيار العملة بجانب حقل قيمة السعر
        function appendCurrencySelector(container) {
            const wrap = document.createElement('div');
            wrap.style.marginTop = '8px';

            const label = document.createElement('div');
            label.textContent = 'العملة:';
            label.style.cssText = 'font-size:12px; font-weight:bold; color:#555; margin-bottom:4px;';

            const currencySelect = document.createElement('select');
            currencySelect.id = 'nms-price-currency-select';
            Object.assign(currencySelect.style, {
                width: "100%", padding: "10px", border: "1px solid #ccc",
                borderRadius: "4px", backgroundColor: "#fff", fontSize: "14px"
            });
            currencySelect.innerHTML = `
                <option value="">كل العملات</option>
                <option value="USD">دولار $</option>
                <option value="ILS">شيكل ₪</option>
                <option value="JOD">دينار د.أ</option>
            `;

            wrap.appendChild(label);
            wrap.appendChild(currencySelect);
            container.appendChild(wrap);
        }

        function renderValueSelect(values) {
            valueContainer.innerHTML = '';
            const select = document.createElement('select');
            select.id = 'nms-value-select';
            select.innerHTML = '<option value="">-- اختر قيمة --</option>' +
                '<option value="__custom__">✏️ قيمة مخصصة (اكتب)</option>' +
                values.map(v => `<option value="${v}">${v}</option>`).join('');
            select.onchange = () => {
                if (select.value === '__custom__') {
                    valueContainer.innerHTML = '';
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.id = 'nms-value-select';
                    input.placeholder = 'اكتب القيمة هنا...';
                    valueContainer.appendChild(input);

                    if (fieldSelect && fieldSelect.value === 'price') {
                        appendCurrencySelector(valueContainer);
                    }
                }
            };
            valueContainer.appendChild(select);

            // 🆕 إذا كان الحقل المختار هو السعر، أضف قائمة اختيار العملة
            if (fieldSelect && fieldSelect.value === 'price') {
                appendCurrencySelector(valueContainer);
            }
        }

        const operatorLabels = { '=': 'يساوي', 'contains': 'يحتوي على', '>': '≥', '<': '≤' };

        function renderConditions() {
            conditionsList.innerHTML = '';
            conditions.forEach((c, i) => {
                const tag = document.createElement('span');
                tag.className = 'nms-condition-tag';
                tag.innerHTML = `${c.fieldName} ${c.operatorLabel} <b>${c.value}</b> <i class="fas fa-times"></i>`;
                tag.querySelector('i').onclick = () => { conditions.splice(i, 1); renderConditions(); };
                conditionsList.appendChild(tag);
            });
        }

        addConditionBtn.onclick = () => {
            const valEl = document.getElementById('nms-value-select');
            const val = valEl ? valEl.value.trim() : '';
            if (!val || val === '__custom__') return;
            conditions.push({
                field: fieldSelect.value,
                fieldName: fieldSelect.options[fieldSelect.selectedIndex].text,
                operator: operatorSelect.value,
                operatorLabel: operatorLabels[operatorSelect.value],
                value: val
            });

            // 🆕 إضافة شرط العملة تلقائياً إذا كان الحقل هو السعر وتم اختيار عملة محددة
            if (fieldSelect.value === 'price') {
                const currencySelect = document.getElementById('nms-price-currency-select');
                if (currencySelect && currencySelect.value) {
                    conditions.push({
                        field: 'currency',
                        fieldName: 'العملة',
                        operator: '=',
                        operatorLabel: operatorLabels['='],
                        value: currencySelect.value
                    });
                }
            }

            renderConditions();
        };

        clearSearchBtn.onclick = () => {
            conditions = [];
            renderConditions();
            executeSearch();
        };

        runSearchBtn.onclick = () => executeSearch();

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

            conditions.forEach((c, i) => {
                params.append(`field_${i}`, c.field);
                params.append(`operator_${i}`, c.operator);
                params.append(`value_${i}`, c.value);
            });
            if (conditions.length > 0) params.append('conditions_count', conditions.length);

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
            features.forEach((f, index) => {
                const p = f.properties;
                const coords = getFeatureCoords(f);
                const card = document.createElement('div');
                card.className = 'nms-result-card';
                card.style.setProperty('--i', Math.min(index, 20));

                let html = '';
                if (!isRealEstate) html += getStatusBadge(p.auto_status, p.work_hours);
                if (p.name) html += `<div class="nms-r-name"><i class="fas fa-user"></i> ${sanitize(p.name)}</div>`;
                if (p.location_name || p.location) html += `<div class="nms-r-loc"><i class="fas fa-map-marker-alt"></i> ${sanitize(p.location_name || p.location)}</div>`;

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

                card.innerHTML = html;

                if (p.whatsapp) {
                    const whatsappNumber = p.whatsapp.toString();
                    const cleanDigits = whatsappNumber.replace(/\D/g, '');
                    const localPhone = '0' + cleanDigits.slice(5);
                    const providerName = p.name || (isRealEstate ? 'المعلن' : 'مزود الخدمة');

                    const actions = document.createElement('div');
                    actions.className = 'nms-r-actions';
                    actions.innerHTML = `
                        <button class="nms-call-btn"><i class="fas fa-mobile-alt"></i> اتصال</button>
                        <button class="nms-whatsapp-btn"><i class="fab fa-whatsapp"></i> واتساب</button>
                    `;
                    actions.querySelector('.nms-call-btn').onclick = async () => {
                        const quota = await checkRequestQuotaOrAlert(getRealUserId(), null);
                        if (!quota.allowed) return;
                        trackRequest(providerName, `(${layerTitle}) اتصال مباشر`);
                        window.location.href = 'tel:' + localPhone;
                    };
                    actions.querySelector('.nms-whatsapp-btn').onclick = async () => {
                        // نفتح تبويباً فارغاً فوراً ضمن نفس حركة النقر لتفادي حجب المتصفح
                        // للنوافذ المنبثقة، ثم نوجهه للرابط الصحيح بعد التأكد من عدم تجاوز الحد
                        const newTab = window.open('', '_blank');
                        const quota = await checkRequestQuotaOrAlert(getRealUserId(), newTab);
                        if (!quota.allowed) return;
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

                if (coords) {
                    const goBtn = document.createElement('button');
                    goBtn.className = 'nms-goto-map-btn';
                    goBtn.innerHTML = '<i class="fas fa-map-location-dot"></i> الانتقال إلى الخريطة';
                    goBtn.onclick = () => {
                        // فتح الخريطة في تبويب جديد
                        window.open(`index.html?x=${coords[0].toFixed(3)}&y=${coords[1].toFixed(3)}`, '_blank');
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
    });
})();
/**
 * config.js - النسخة الاحترافية المطورة (عقل المنصة)
 */

const MAP_CONFIG = {
    server: {
        // استخدام البروكسي النسبي دائماً (يمر عبر IIS → Node → GeoServer)
        // هذا يمنع حظر Mixed Content على HTTPS ويخفي الـ IP والبورت عن الواجهة
        proxyUrl: "/geoserver-proxy/",
        srsName: "EPSG:28191",
        apiUrl: window.location.origin + "/"
    },

    // إعدادات افتراضية للستايلات (أحجام الأيقونات والخطوط)
    uiStyle: {
        defaultIconScale: 0.15,
        labelFont: "bold 14px Arial, sans-serif",
        labelColor: "#333",
        labelOutline: "#ffffff"
    },

    // طبقات وفئات مستثناة عالمياً من العرض والبحث.
    // استخدم المعرّف الداخلي أو اسم طبقة WFS؛ والعقارات تقبل أيضاً الاسم العربي.
    // أمثلة متكافئة: saleLayer / ApartSale / شقق للبيع.
    // نبدأ بإظهار العقارات الثلاثة فقط. لإعادة خدمة للاختبار احذف اسمها
    // من هذه القائمة؛ لا تحذف saleLayer أو rentLayer أو landLayer.
    globalExclusions: [
        // طبقات مساعدة لا نحتاجها حالياً في نسخة العقارات فقط
        'cityLayer', 'locationLayer', 'roadsLayer', 'governorateLayer',

        // حواجز الطرق ومحطات الوقود
        'road_barriers', 'fuel_stations',

        // الفنيون والصيانة المنزلية
        'electrician', 'ac_technician', 'plumber', 'general_maintenance', 'painter',
        'Finisher', 'carpenter', 'blacksmith', 'builder', 'house_cleaner', 'aluminum_tech',
        'glass_tech', 'cctv_installer', 'gardener', 'security_firms', 'furniture_buyer',

        // الصحة والرعاية
        'home_nurse', 'masseur', 'cupping_specialist', 'nutritionist', 'pharmacies_on_call',
        'emergency_hospitals', 'clinics', 'doctors_on_call', 'ambulances_on_call', 'pet_care',

        // المركبات والتوصيل
        'car_mechanic', 'car_electrician', 'tire_tech', 'car_wash', 'motorcycle_repair',
        'taxi_driver', 'delivery_services', 'tow_truck', 'truck_driver', 'taxis_on_call',
        'car_delivery_on_call', 'motorcycle_delivery_on_call', 'bicycle_delivery_on_call',

        // المهن الحرة والتعليم الخصوصي
        'lawyers', 'land_surveyors', 'real_estate_valuers', 'private_tutors', 'programmers',
        'music_training', 'student_research_assist',

        // المناسبات والترفيه والضيافة
        'party_planner', 'zaffa_bands', 'music_bands', 'party_rental', 'clown_entertainer',
        'martial_arts_gymnastics', 'public_parks_recreation', 
        'barber_shop', 'video_design_ads', 'photographers',

        // المتاجر والمطاعم والتعليم والمعالم والوظائف وباقي الخدمات
        'online_stores', 'free_distribution', 'supermarket', 'commercial_shops', 'restaurants',
        'schools_kindergartens', 'job_vacancies', 'city_landmarks'
    ],

    // مصفوفة الصلاحيات (التحكم في ظهور العناصر)
    rolePermissions: {
        admin: {
            canEdit: true,
            canSearch: true,
            canMeasure: true,
            canShare: true,
            canViewResults: true,
            canManageLayers: true
        },
        provider: {
            canEdit: false,
            canSearch: true,
            canMeasure: true,
            canShare: true,
            canViewResults: true,
            canManageLayers: true
        },
        user: {
            canEdit: false,
            canSearch: true,
            canMeasure: true,
            canShare: true,
            canViewResults: true,
            canManageLayers: true
        }
    },

    // حصر جميع العناصر (IDs) لسهولة التحكم البرمجي لاحقاً
    uiElements: {
        // أزرار التحرير
        editButtons: ['editBtn', 'polygonEditBtn', 'lineEditBtn', 'editPanel', 'polygonEditPanel', 'lineEditPanel'],
        // أدوات البحث
        searchTools: ['search-btn', 'global-search-wrapper', 'quick-search-wrapper', 'search-panel'],
        // أدوات القياس
        measureTools: ['measure-tools-toggle-btn', 'measurePanel'],
        // أدوات الخريطة الإضافية
        mapTools: ['togglePopupBtn', 'activate-location-btn', 'nearby-apartments-panel', 'share-location-btn', 'shareLocationPanel'],
        // التحكم بالطبقات
        layerTools: ['toggleLayerPanel', 'layerPanel'],
        // النتائج
        resultsPanel: ['results-panel']
    },

    propertyFields: [
        { name: 'name', label: 'اسم المتصرف', type: 'text' },
        { name: 'location', label: 'المنطقة', type: 'text', autoFill: true },
        { name: 'price', label: 'السعر ($)', type: 'number' },
        { name: 'area', label: 'المساحة (م²)', type: 'number' },
        { name: 'des', label: 'الوصف', type: 'text' },
        { name: 'whatsapp', label: 'رقم الواتساب', type: 'text' },
        { name: 'phone', label: 'رقم الهاتف', type: 'text' },
        { name: 'pic', label: 'رابط الصورة', type: 'text' },
        { name: 'video', label: 'رابط الفيديو', type: 'text' },
        { name: 'work_hours', label: 'ساعات العمل', type: 'text' },
        { name: 'start_date', label: 'تاريخ الإنشاء', type: 'date' },
        { name: 'end_date', label: 'تاريخ انتهاء الاشتراك', type: 'date' },
        { name: 'status', label: 'الحالة (0 أو 1)', type: 'number', default: 0 },
        { name: 'rating', label: 'التقييم (1-10)', type: 'number' },
        { name: 'search_tags', label: 'كلمات البحث', type: 'text' }
    ],

    serviceFields: [
        { name: 'name', label: 'اسم مزود الخدمة', type: 'text' },
        { name: 'location_name', label: 'المنطقة', type: 'text', autoFill: true },
        { name: 'price', label: 'السعر ($)', type: 'number' },
        { name: 'area', label: 'المساحة (م²)', type: 'number' },
        { name: 'whatsapp', label: 'رقم الواتساب', type: 'text' },
        { name: 'phone', label: 'رقم الهاتف', type: 'text' },
        { name: 'rating', label: 'التقييم (1-10)', type: 'number' },
        { name: 'des', label: 'وصف الخدمة والخبرة', type: 'text' },
        { name: 'pic', label: 'رابط الصورة', type: 'text' },
        { name: 'video', label: 'رابط الفيديو', type: 'text' },
        { name: 'details_link_1', label: 'رابط تفاصيل 1', type: 'text' },
        { name: 'details_link_2', label: 'رابط تفاصيل 2', type: 'text' },
        { name: 'work_hours', label: 'ساعات العمل', type: 'text' },
        { name: 'start_date', label: 'تاريخ الإنشاء', type: 'date' },
        { name: 'end_date', label: 'تاريخ انتهاء الاشتراك', type: 'date' },
        { name: 'status', label: 'الحالة', type: 'number', default: 0 },
        { name: 'search_tags', label: 'كلمات البحث', type: 'text' }
    ],

    layers: {
        // طبقات المساعدة: تظهر بمقاييس كبيرة (من بعيد)
        helper: [
            { id: "governorateLayer", workspace: "realestate", name: "Governorate", title: "المحافظات", style: "window.styleGovernorate", maxRes: 2000, labelThreshold: 200 },
            { id: "cityLayer", workspace: "realestate", name: "City", title: "المدن", style: "window.styleCity", maxRes: 100, labelThreshold: 30 },
            { id: "locationLayer", workspace: "realestate", name: "Location", title: "المناطق", style: "window.styleLocation", maxRes: 15, labelThreshold: 5 },
            { id: "roadsLayer", workspace: "realestate", name: "RoadsTest", title: "الطرق", style: "window.roadsStyle", maxRes: 3, visible: false, labelThreshold: 1.5 }
        ],
        // طبقات العقارات: تظهر عند الاقتراب لضمان الدقة
        realestate: [
            { id: "rentLayer", workspace: "realestate", name: "ApartRent", title: "شقق الإيجار", style: "window.styleRent", maxRes: 1, labelThreshold: 0.8 },
            { id: "saleLayer", workspace: "realestate", name: "ApartSale", title: "شقق للبيع", style: "window.styleSale", maxRes: 1, labelThreshold: 0.8 },
            { id: "landLayer", workspace: "realestate", name: "LandSale", title: "الأراضي للبيع", style: "window.styleLand", maxRes: 1, labelThreshold: 1.2 }
        ],
        // طبقات الخدمات: 59 طبقة، تظهر فقط عند زووم عالي لتفادي ازدحام الخريطة
        services: [
            { workspace: "services", stylePrefix: "service", maxRes: 0.5, labelThreshold: 0.6 }
        ]
    }
};

// تجميد الكائن لضمان عدم التلاعب بالإعدادات برمجياً أثناء التشغيل
Object.freeze(MAP_CONFIG);

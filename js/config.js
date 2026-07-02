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

    // 5. طبقات مستثناة عالمياً من العرض والبحث
    // ملاحظة: يجب استخدام "المفتاح البرمجي" (Key) المستخدم في ملف layers.js
    globalExclusions: [ 
       
        
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
        { name: 'location', label: 'المنطقة', type: 'text', autoFill: true },
        { name: 'price', label: 'السعر ($)', type: 'number' },
        { name: 'area', label: 'المساحة (م²)', type: 'number' },
        { name: 'des', label: 'الوصف', type: 'text' },
        { name: 'whatsapp', label: 'رقم الواتساب', type: 'text' },
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
        { name: 'whatsapp', label: 'رقم الواتساب', type: 'text' },
        { name: 'rating', label: 'التقييم (1-10)', type: 'number' },
        { name: 'des', label: 'وصف الخدمة والخبرة', type: 'text' },
        { name: 'pic', label: 'رابط الصورة', type: 'text' },
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
            { id: "rentLayer", workspace: "realestate", name: "ApartRent", title: "شقق الإيجار", style: "window.styleRent", maxRes: 10, labelThreshold: 0.8 },
            { id: "saleLayer", workspace: "realestate", name: "ApartSale", title: "شقق للبيع", style: "window.styleSale", maxRes: 10, labelThreshold: 0.8 },
            { id: "landLayer", workspace: "realestate", name: "LandSale", title: "الأراضي للبيع", style: "window.styleLand", maxRes: 15, labelThreshold: 1.2 }
        ],
        // طبقات الخدمات: 59 طبقة، تظهر فقط عند زووم عالي لتفادي ازدحام الخريطة
        services: [
            { workspace: "services", stylePrefix: "service", maxRes: 8, labelThreshold: 0.6 }
        ]
    }
};

// تجميد الكائن لضمان عدم التلاعب بالإعدادات برمجياً أثناء التشغيل
Object.freeze(MAP_CONFIG);

/**
 * config.js - النسخة الشاملة المحدثة
 */

const MAP_CONFIG = {
    server: {
        proxyUrl: "/proxy/geoserver/",
        srsName: "EPSG:28191",
    },

    // 1. حقول العقارات (تم إضافة rating و search_tags)
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

    // 2. حقول الخدمات (موجود فيها search_tags مسبقاً)
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

    // 3. تعريف الطبقات (نظام الحاويات)
    layers: {
        helper: [ 
            { id: "governorateLayer", workspace: "realestate", name: "Governorate", title: "المحافظات", style: "window.styleGovernorate", maxRes: 1000 },
            { id: "cityLayer", workspace: "realestate", name: "City", title: "المدن", style: "window.styleCity", maxRes: 30 },
            { id: "locationLayer", workspace: "realestate", name: "Location", title: "المناطق", style: "window.styleLocation", maxRes: 20 },
            { id: "roadsLayer", workspace: "realestate", name: "RoadsTest", title: "الطرق", style: "window.roadsStyle", maxRes: 0.7, visible: false }
        ],
        realestate: [
            { id: "rentLayer", workspace: "realestate", name: "ApartRent", title: "شقق الإيجار", style: "window.styleRent" },
            { id: "saleLayer", workspace: "realestate", name: "ApartSale", title: "شقق البيع", style: "window.styleSale" },
            { id: "landLayer", workspace: "realestate", name: "LandSale", title: "الأراضي للبيع", style: "window.styleLand" }
        ],
        services: [
            // سيتم توليد الـ 34 القديمة + الـ 25 الجديدة آلياً من ملف الترجمة
            { workspace: "services", stylePrefix: "service" }
        ]
    }
};
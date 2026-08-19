/**
 * widgets-config.js
 * ملف تكوين البيانات اليدوية للتحديثات الفورية
 * هذا الملف يحتوي على البيانات التي يمكن تعديلها يدوياً بسهولة
 * بدون الحاجة لتعديل الكود الأساسي
 */

const WIDGETS_MANUAL_DATA = {
    // ============================================
    // القسم الأول: البيانات اليدوية (سهلة التعديل)
    // ============================================
    
    // أسعار العملات (يدوي)
    currency: [
        { id: 'currency-usd-ils', label: 'دولار أمريكي', code: 'USD/ILS', value: '3.45' },
        { id: 'currency-jod-ils', label: 'دينار أردني', code: 'JOD/ILS', value: '4.86' },
        { id: 'currency-eur-ils', label: 'يورو', code: 'EUR/ILS', value: '3.72' }
        // يمكنك إضافة عملات جديدة هنا:
        // { id: 'currency-gbp-ils', label: 'جنيه إسترليني', code: 'GBP/ILS', value: '4.38' }
    ],
    
    // أسعار الذهب (يدوي)
    gold: [
        { id: 'gold-24', label: 'ذهب عيار 24', value: '215.5', unit: 'شيكل/غرام' },
        { id: 'gold-21', label: 'ذهب عيار 21', value: '188.5', unit: 'شيكل/غرام' },
        { id: 'gold-18', label: 'ذهب عيار 18', value: '161.5', unit: 'شيكل/غرام' },
        { id: 'gold-ounce', label: 'أونصة الذهب عالمياً', value: '2450', unit: 'دولار/أونصة' },
        { id: 'silver', label: 'الفضة', value: '28.50', unit: 'دولار/أونصة' }
        // يمكنك إضافة معادن جديدة هنا
    ],
    
    // أسعار المحروقات والغاز (مدمجة)
    fuel: [
        { id: 'fuel-95', label: 'بنزين 95', value: '6.85', unit: 'شيكل/لتر' },
        { id: 'fuel-98', label: 'بنزين 98', value: '7.05', unit: 'شيكل/لتر' },
        { id: 'fuel-diesel', label: 'سولار', value: '8.56', unit: 'شيكل/لتر' },
        { id: 'fuel-gas-cylinder', label: 'أسطوانة غاز', value: '35.00', unit: 'شيكل' },
        { id: 'fuel-gas-large', label: 'غاز حجم كبير', value: '85.00', unit: 'شيكل' },
        { id: 'fuel-gas-small', label: 'غاز حجم صغير', value: '45.00', unit: 'شيكل' }
        // يمكنك إضافة أنواع جديدة هنا:
        // { id: 'fuel-kerosene', label: 'كيروسين', value: '5.50', unit: 'شيكل/لتر' }
    ],
    
    // حالة الطرق (يدوي)
    traffic: [
        { id: 'traffic-betunia-ramallah', label: 'بيت إيل - رام الله', status: 'closed', icon: 'fa-road' },
        { id: 'traffic-jaba-jerusalem', label: 'جبع القدس', status: 'open', icon: 'fa-car' },
        { id: 'traffic-farsha-hebron', label: 'فرش الهوا الخليل', status: 'warning', icon: 'fa-road' },
        { id: 'traffic-ashgharab-bethlehem', label: 'عش الغراب - بيت لحم', status: 'light', icon: 'fa-road' }
        // يمكنك إضافة طرق جديدة هنا:
        // { id: 'traffic-checkpoint', label: 'اسم الحاجز', status: 'open', icon: 'fa-road' }
    ],
    
    // أجرة النقل بين المدن
    transport_inter_city: [
        { id: 'transport-ramallah-hebron', label: 'رام الله - الخليل', value: '30', unit: 'شيكل' },
        { id: 'transport-ramallah-bethlehem', label: 'رام الله - بيت لحم', value: '22', unit: 'شيكل' },
        { id: 'transport-ramallah-jericho', label: 'رام الله - أريحا', value: '15', unit: 'شيكل' },
        { id: 'transport-ramallah-nablus', label: 'رام الله - نابلس', value: '18', unit: 'شيكل' }
        // يمكنك إضافة مسارات جديدة هنا
    ],
    
    // أجرة النقل الداخلية (رام الله - البيرة)
    transport_intra_city: [
        { id: 'transport-bireh-qalandia', label: 'البيرة - قلنديا', value: '4.5', unit: 'شيكل' },
        { id: 'transport-bireh-albalou', label: 'البيرة - البالوع', value: '3.5', unit: 'شيكل' },
        { id: 'transport-bireh-bitunia', label: 'البيرة - بيتونيا', value: '5', unit: 'شيكل' },
        { id: 'transport-bireh-umsharayet', label: 'البيرة - أم الشرايط', value: '3.5', unit: 'شيكل' }
        // يمكنك إضافة مسارات داخلية جديدة هنا
    ],
    
    // المناسبات القادمة (بالتاريخ الميلادي)
    events: [
        { id: 'event-1', label: 'يوم الأرض', date: '2026-03-30' },
        { id: 'event-2', label: 'عيد الفطر', date: '2026-06-17' },
        { id: 'event-3', label: 'عيد الأضحى', date: '2026-08-23' }
        // يمكنك إضافة مناسبات جديدة هنا:
        // { id: 'event-4', label: 'اسم المناسبة', date: 'YYYY-MM-DD' }
    ]
};

// ============================================
// القسم الثاني: إعدادات APIs الخارجية
// ============================================

const WIDGETS_API_CONFIG = {
    // حالة الطقس
    weather: {
        enabled: true,
        url: 'https://api.openweathermap.org/data/2.5/weather',
        updateInterval: 1800000 // 30 دقيقة
    },
    
    // مواقيت الصلاة (API للقدس - Aladhan API)
    prayer: {
        enabled: true,
        url: 'https://api.aladhan.com/v1/timingsByCity?city=Jerusalem&country=Palestine&method=2',
        updateInterval: 3600000 // ساعة واحدة
    },
    
    // التقويم الهجري والميلادي (API للقدس - Aladhan API)
    calendar: {
        enabled: true,
        url: 'https://api.aladhan.com/v1/gToH',
        updateInterval: 86400000 // يوم واحد
    }
};

// ============================================
// القسم الثالث: إعدادات العرض العامة
// ============================================

const WIDGETS_DISPLAY_CONFIG = {
    // تفعيل/تعطيل التحديث التلقائي
    autoUpdate: true,
    
    // فترة التحديث الافتراضية (بالمللي ثانية)
    defaultUpdateInterval: 300000, // 5 دقائق
    
    // عدد العناصر المعروضة في الشريط المتحرك
    maxTickerItems: 20,
    
    // سرعة الحركة للشريط المتحرك (بالثواني)
    tickerAnimationDuration: 30,
    
    // تفعيل/تعطيل الأيقونات
    showIcons: true,
    
    // تفعيل/تعطيل الوحدات
    showUnits: true
};

// تصدير الإعدادات للاستخدام في widgets-ticker.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WIDGETS_MANUAL_DATA,
        WIDGETS_API_CONFIG,
        WIDGETS_DISPLAY_CONFIG
    };
}

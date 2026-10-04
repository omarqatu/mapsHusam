// Which layers exist: the whitelist (service types from shared/service-types.json), their Arabic names, and pool routing.
import fs from 'fs';
import path from 'path';
import { ROOT_DIR } from './app.js';
import { realestatePool, servicesPool } from './database.js';

// [إجراء أمني 1]: قائمة بيضاء للطبقات المسموح بالوصول إليها والتعديل عليها (تشمل كافة الخدمات والعقارات الفعالة)
// أنواع الخدمات من shared/service-types.json: نفس الملف الذي تبني منه الواجهة قائمتها (مصدر واحد)
export const SERVICE_TYPE_KEYS = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'shared', 'service-types.json'), 'utf8'))
    .map((type) => type.key);
// طبقات العقارات والمواقع الفعالة + قيمة service_all الخاصة بالبحث العالمي (كل الخدمات دفعة واحدة بدون discriminator)
const OTHER_LAYERS = ['ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest', 'service_all'];
const ALLOWED_LAYERS = [...SERVICE_TYPE_KEYS, ...OTHER_LAYERS];

export const isValidLayer = (layer) => typeof layer === 'string' && ALLOWED_LAYERS.includes(layer.trim());

export const REAL_ESTATE_LAYERS = ['ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest'];
// دالة مسارة لاختيار الاتصال المناسب حسب الطبقة
export function getPoolForLayer(layerName) {
    if (REAL_ESTATE_LAYERS.includes(layerName)) {
        return realestatePool;
    }
    return servicesPool;
}

// 🆕 [إصلاح عرض اسم الطبقة بالعربي]: قاموس ترجمة موحّد يُستخدم عند تسجيل نقرات
// الاتصال/الواتساب (log-contact-click) لتخزين service_type بالعربي بدل الاسم
// الإنجليزي الخام للطبقة، تماماً كما يحدث أصلاً لطلبات "طلب الخدمة" الحقيقية.
export const LAYER_AR_NAMES = {
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
    'barber_shop': 'حلاقة شباب', 'photographers': 'مصور فوتوغرافي', 'video_design_ads': 'تصميم فيديو إعلاني',
    'pharmacies_on_call': 'صيدليات مناوبة', 'taxis_on_call': 'تكاسي نظام مناوبة', 'emergency_hospitals': 'طوارئ ومستشفيات',
    'clinics': 'عيادات', 'doctors_on_call': 'دكاترة مناوبة', 'ambulances_on_call': 'إسعاف مناوبة',
    'music_training': 'تدريب موسيقى ومعاهد', 'lawyers': 'محاميين', 'land_surveyors': 'مساحين أراضي',
    'real_estate_valuers': 'مخمنين عقاريين', 'private_tutors': 'أساتذة خصوصي', 'programmers': 'مبرمجين',
    'car_delivery_on_call': 'دليفري سيارات (مناوبة)', 'motorcycle_delivery_on_call': 'دليفري دراجات (مناوبة)',
    'bicycle_delivery_on_call': 'دليفري هوائية (مناوبة)', 'student_research_assist': 'مساعد أبحاث طلاب',
    'supermarket': 'سوبرماركت', 'commercial_shops': 'محلات تجارية', 'restaurants': 'مطاعم وكوفي شوبات',
    'schools_kindergartens': 'مدارس ورياض أطفال', 'job_vacancies': 'وظائف شاغرة', 'city_landmarks': 'معالم المدينة',
    'ApartRent': 'شقة للإيجار', 'ApartSale': 'شقة للبيع', 'LandSale': 'أرض للبيع',
    'rent': 'شقة للإيجار', 'sale': 'شقة للبيع', 'land': 'أرض للبيع'
};
// =========================================================================
// 🆕 [تشديد أمني]: أسماء الحقول (columns) القادمة من الفرونت إند كانت تُدمج
// مباشرة داخل نص استعلام SQL بدون أي تحقق (في /api/get-unique-values و
// /api/search-features)، وهذا يفتح ثغرة SQL Injection حقيقية عبر تمرير اسم
// حقل خبيث بدل اسم حقيقي. هذه الدالة تتحقق أن الاسم يطابق نمط معرّف SQL
// عادي فقط (حروف/أرقام/شرطة سفلية) قبل استخدامه داخل أي استعلام.
// =========================================================================
const SQL_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
export const isValidSqlIdentifier = (name) => typeof name === 'string' && SQL_IDENTIFIER_REGEX.test(name);
export const PLATFORM_PROPERTY_LAYERS = ['ApartRent', 'ApartSale', 'LandSale'];
export const PLATFORM_SERVICE_LAYERS = ALLOWED_LAYERS.filter(layer =>
    !REAL_ESTATE_LAYERS.includes(layer) && !['service_all', 'Location', 'RoadsTest'].includes(layer)
);

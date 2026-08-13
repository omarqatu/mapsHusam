# هيكلية الخدمات الموحدة (Unified Services Architecture)

## 📋 نظرة عامة

هذا الهيكل يوفر طبقة موحدة للوظائف والـ API تخدم نسخة Desktop و Mobile معاً. أي تعديل في ملف واحد ينعكس تلقائياً على المنصتين.

## 🏗️ الهيكلية

```
frontend-react/
├── src/
│   ├── services/
│   │   ├── api.js              # طبقة API مركزية (جميع الاتصالات بالسيرفر)
│   │   ├── coreService.js      # طبقة الوظائف الأساسية (إحداثيات، مزودي خدمة، إحصائيات)
│   │   ├── mobileService.js    # طبقة خدمات الموبايل (تبويبات، تنقل، إيماءات)
│   │   └── index.js            # نقطة دخول موحدة
│   ├── hooks/
│   │   └── useApi.js           # Hooks موحدة للاستخدام في React
│   └── utils/
│       └── helpers.js          # دوال مساعدة (نصوص، وقت، روابط، أجهزة)
└── public/
    └── js/
        └── services-bridge.js  # جسر ربط ملفات public/ بالخدمات الجديدة
```

## 🎯 المبادئ الأساسية

### 1. فصل منطق الوظائف عن الواجهات
- جميع الوظائف في `src/services/`
- جميع الواجهات في `src/components/` و `public/`
- لا يوجد كود منطقي في ملفات UI

### 2. خدمة Desktop و Mobile معاً
- نفس الوظائف تعمل على المنصتين
- خدمات الموبايل الخاصة في `mobileService.js`
- اكتشاف تلقائي لنوع الجهاز

### 3. الحفاظ على آلية العمل الحالية
- ملفات `public/` تعمل كما هي
- `services-bridge.js` يربط الملفات القديمة بالخدمات الجديدة
- يمكن الاستمرار في التعديل على ملفات `public/`

## 📚 الخدمات المتاحة

### API Service (`api.js`)
جميع الاتصالات بالسيرفر مع retry mechanism:

```javascript
import { API } from './services';

// التقييمات
await API.ratings.getFeatureRatings(serviceLayer, featureId);
await API.ratings.getPendingComments(userId);

// مزودي الخدمة
await API.providers.getLinkedFeatures();

// الإحصائيات
await API.stats.getPlatformStats();

// البحث
await API.search.searchFeatures(params);
```

### Core Service (`coreService.js`)
الوظائف الأساسية المشتركة:

```javascript
import { CoordinateUtils, ProviderService, StatsService, RatingsService, SearchService } from './services';

// الإحداثيات
const coords = CoordinateUtils.getFeatureCoords(feature);
const text = CoordinateUtils.coordsToText(coords);
const link = CoordinateUtils.createLocationLink(coords);

// مزودي الخدمة
await ProviderService.refreshLinkedFeatures();
const isLinked = ProviderService.isFeatureLinked(layerDbName, featureId);

// الإحصائيات
const stats = await StatsService.getStats();
const formatted = StatsService.formatNumber(1234);

// التقييمات
const ratings = await RatingsService.fetchFeatureRatings(serviceLayer, featureId);

// البحث
const results = await SearchService.searchFeatures(params);
```

### Mobile Service (`mobileService.js`)
خدمات خاصة بالموبايل:

```javascript
import { TabService, NavigationService, MobileModeService } from './services';

// التبويبات
const tabs = TabService.getTabs();
const activeTab = TabService.getActiveTab();
TabService.setActiveTab('map');

// التنقل
NavigationService.navigateTo('search', { query: 'فني' });
NavigationService.goBack();

// وضع الموبايل
MobileModeService.enableMobileMode();
const isMobile = MobileModeService.isMobileModeEnabled();
```

### Utils (`helpers.js`)
دوال مساعدة متنوعة:

```javascript
import { StringUtils, TimeUtils, URLUtils, DeviceUtils } from './utils/helpers';

// النصوص
const clean = StringUtils.sanitizeHTML(dirtyString);
const escaped = StringUtils.escapeForAttribute(str);
const formatted = StringUtils.formatCurrency(1000, 'USD');

// الوقت
const date = TimeUtils.parseArabicTime('٩:٠٠ ص');
const hours = TimeUtils.formatWorkHours(open, close);
const status = TimeUtils.getServiceStatus(open, close);

// الروابط
const clean = URLUtils.cleanURL(url);
await URLUtils.copyLocationLink(coords);

// الأجهزة
const device = DeviceUtils.getDeviceType(); // 'mobile' | 'tablet' | 'desktop'
const isMobile = DeviceUtils.isMobile();
```

### Hooks (`useApi.js`)
Hooks موحدة للاستخدام في React:

```javascript
import { useRatings, usePlatformStats, useSearch } from './hooks/useApi';

// التقييمات
const { data, loading, error } = useRatings(serviceLayer, featureId);

// الإحصائيات
const { data: stats } = usePlatformStats();

// البحث
const { data: results } = useSearch(params, true);
```

## 🔗 Services Bridge

ملف `services-bridge.js` يربط ملفات `public/` بالخدمات الجديدة:

```javascript
// في ملفات public/js/
// يمكن استخدام الخدمات الجديدة مباشرة
const ratings = await window.AppServices.API.ratings.getFeatureRatings(layer, id);
const coords = window.AppServices.CoordinateUtils.getFeatureCoords(feature);
const isLinked = window.AppServices.ProviderService.isFeatureLinked(layer, id);
```

## 🚀 الاستخدام

### في React Components

```javascript
import { API, CoordinateUtils } from '../services';

function MyComponent() {
  const fetchRatings = async () => {
    const data = await API.ratings.getFeatureRatings('electrician', 123);
  };
  
  const getCoords = (feature) => {
    return CoordinateUtils.getFeatureCoords(feature);
  };
  
  return <div>...</div>;
}
```

### في ملفات public/js

```javascript
// الخدمات متاحة عبر window.AppServices
const ratings = await window.AppServices.API.ratings.getFeatureRatings('electrician', 123);
const coords = window.AppServices.CoordinateUtils.getFeatureCoords(feature);
```

## 🔄 التعديل والتحديث

### تعديل وظيفة موجودة
1. افتح الملف المناسب في `src/services/`
2. عدل الوظيفة
3. التغيير ينعكس تلقائياً على Desktop و Mobile

### إضافة وظيفة جديدة
1. أضف الوظيفة في الملف المناسب (`api.js`, `coreService.js`, إلخ)
2. أضفها إلى `services/index.js`
3. أضفها إلى `services-bridge.js` إذا لزم الأمر

### إضافة خدمة موبايل جديدة
1. أضف الوظيفة في `mobileService.js`
2. أضفها إلى `services/index.js`
3. أضفها إلى `services-bridge.js`

## 📱 دعم الموبايل

### ملفات الموبايل المدمجة
- `mobile-tabs.js` - تم دمج وظائفه في `mobileService.js`
- أي ملف موبايل آخر يمكن دمجه بنفس الطريقة

### اكتشاف نوع الجهاز
```javascript
import { DeviceUtils } from './utils/helpers';

if (DeviceUtils.isMobile()) {
  // كود الموبايل
} else if (DeviceUtils.isDesktop()) {
  // كود الحاسوب
}
```

## ⚠️ ملاحظات مهمة

1. **عدم المساس بالواجهات**: لا تعدل ملفات HTML/CSS في `public/`
2. **الخدمات فقط**: عدل فقط ملفات الخدمات في `src/services/`
3. **الاختبار**: اختبر على Desktop و Mobile بعد كل تعديل
4. **النسخ الاحتياطي**: د alltid نسخ احتياطية قبل التعديل

## 🎯 الفوائد

1. **كود موحد**: تعديل واحد يخدم المنصتين
2. **صيانة أسهل**: الوظائف في مكان واحد
3. **قابلية التوسع**: سهولة إضافة وظائف جديدة
4. **اختبار أفضل**: اختبار الوظائف بشكل منفصل
5. **دعم الموبايل**: هيكلية جاهزة للتطبيق الموبايل

## 📞 الدعم

لأي استفسار أو مشكلة، راجع:
- ملفات الخدمات في `src/services/`
- ملف الجسر في `public/js/services-bridge.js`
- ملف README هذا

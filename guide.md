# دليل شامل: إضافة وحذف طبقة من الصفر عبر كامل المنصة

هذا الدليل مبني فعلياً على بنية مشروعك الحالية (PostgreSQL + GeoServer + Node/Express + OpenLayers). فيه مسارين رئيسيين لأن التعامل مختلف حسب نوع الطبقة:

- **النقاط (Point)** — مثل: فني زجاج سكريت، سوبرماركت، محلات تجارية، مطاعم، مدارس ورياض أطفال. هذه كلها بقاعدة `services_db`.
- **المضلعات (Polygon)** — مثل: المباني. هذه بقاعدة `realestate`.
- **الخطوط (Line)** — مثل: الطرق. عندك أصلاً جدول `RoadsTest` جاهز في `realestate` وكل الكود يدعمه، فقط ناقصك تعبئته بالبيانات الكاملة.

⚠️ **ملاحظة حرجة قبل ما تبدأ**: طبقات النقاط (الخدمات) مبنية بشكل *ديناميكي* بالكامل من كائن واحد (`serviceTranslations` في `layers.js`) — إضافة خدمة جديدة سهلة جداً وتنعكس أوتوماتيكياً بمعظم الملفات. أما طبقات **المضلعات** (زي المباني) فالكود في `editPolygons.js` مكتوب *hardcoded* لطبقتين بس (`landLayer` و `locationLayer`) — فإضافة مضلع جديد فيها تعديل كود فعلي مش بس إعدادات. راح أوضح كل حالة لحالها.

---

## الجزء الأول: إضافة طبقة نقطية جديدة (خدمة) — مثال: فني زجاج سكريت

سأستخدم كمثال حي: `glass_tech` (فني زجاج وسكريت). كرر نفس الخطوات لـ `supermarket`، `commercial_shops`، `restaurants`، `schools_kindergartens`.

### 1) PostgreSQL — إنشاء الجدول

كل جداول الخدمات عندك لها نفس البنية (شوف `edit-wfs.js` و`edit-core.js` — الحقول `allowedPropsAdd`/`fieldsServices`). أنشئ الجدول بنفس البنية تماماً حتى ما ينكسر الكود:

```sql
-- في قاعدة services_db
CREATE TABLE public.glass_tech (
    id            SERIAL PRIMARY KEY,
    geom          geometry(Point, 28191),
    name          varchar(255),
    whatsapp      varchar(50),
    des           text,
    pic           text,
    rating        numeric(3,1) DEFAULT 5,
    details_link_1 text,
    details_link_2 text,
    end_date      date,
    work_hours    varchar(100),
    location_name varchar(255),
    x_coord       numeric,
    y_coord       numeric,
    x_global      numeric,
    y_global      numeric,
    status        integer DEFAULT 0,
    gov_a         varchar(255),
    village_a     varchar(255),
    start_date    date,
    auto_status   integer DEFAULT 0,
    search_tags   text
);

CREATE INDEX glass_tech_geom_idx ON public.glass_tech USING GIST (geom);
```

اسم الجدول (`glass_tech`) هو الذي سيُستخدم حرفياً بكل مكان لاحقاً (workspace key)، فاختاره بعناية بالإنجليزي بدون مسافات.

### 2) GeoServer — نشر الطبقة (Publish)

1. ادخل GeoServer admin → **Layers → Add a new layer**.
2. اختر الـ Store الخاص بـ `services_db` (نفس الستور اللي فيه بقية جداول الخدمات).
3. اختر الجدول `glass_tech` من القائمة واضغط **Publish**.
4. تأكد أن:
   - **Declared SRS** = `EPSG:28191`
   - **Native SRS** = نفس الشيء أو Compute from data
   - Bounding Box: اضغط **Compute from data** و **Compute from native bounds**
5. احفظ (Save). تأكد إنه ظاهر تحت الـ workspace نفسه اللي فيه بقية طبقات الخدمات (نفس workspace المستخدم بـ `namespaceUris.services` في `edit-wfs.js`).

### 3) server.js — القائمة البيضاء (أمان WFS + الوصول للجدول)

أضف الاسم بمصفوفة `ALLOWED_LAYERS`:

```js
const ALLOWED_LAYERS = [
    'electrician', 'ac_technician', 'plumber', /* ... */,
    'glass_tech',   // 🆕 أضفها هنا
    // --- طبقات العقارات والمواقع الفعالة ---
    'ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest'
];
```

هذا يمنع أي محاولة وصول لجدول غير مصرح به عبر `/api/get-provider-service`، `/api/update-service-status`، `/api/search-features`، `/api/get-unique-values`.

بدون هذه الخطوة، أي طلب من الفرونت إند لهذه الطبقة سيُرفض بـ 403 حتى لو كل شيء تمام بالباقي.

### 4) layers.js — الإضافة الفعلية (هذه هي الخطوة الأهم)

أضف مدخل واحد فقط بكائن `serviceTranslations`:

```js
const serviceTranslations = {
    'electrician': { name: 'فني كهرباء', icon: '⚡' },
    // ...
    'glass_tech': { name: 'فني زجاج وسكريت', icon: '🪟' }, // 🆕
};
```

هذا وحده كافٍ لتوليد الطبقة أوتوماتيكياً! لأن هذا الجزء من نفس الملف يمر بحلقة تلقائية:

```js
Object.keys(serviceTranslations).forEach(key => {
    if (MAP_CONFIG.globalExclusions.includes(key)) return;
    const info = serviceTranslations[key];
    const sStyle = (f, r) => window.createStyle(f, r, { emoji: info.icon, labelField: 'name', zoomThresholdForLabel: 0.7 });
    window.appLayers[key + 'Layer'] = createWFSLayer('services', key, info.name, sStyle, 1, true, 30);
});
```

يعني `window.appLayers.glass_techLayer` بيتولد لحاله، بالاسم العربي "فني زجاج وسكريت"، والأيقونة 🪟 على الخريطة.

### 5) الأماكن التي *لازم* تعدلها يدوياً حتى تشتغل الطبقة بكامل الميزات

رغم التوليد التلقائي بالخطوة السابقة، في أماكن أخرى الاسم العربي مكتوب **حرفياً كنص ثابت (hardcoded array)** وليس مقروء من `serviceTranslations` — فلازم تطابق الاسم العربي بالضبط بكل مكان:

#### أ) popup.js — `serviceLayerNames`
بدونها البوب أب ما رح يفتح عند الضغط على المعلم:
```js
const serviceLayerNames = [
    'فني كهرباء', 'فني تكييف وتبريد', /* ... */,
    'فني زجاج وسكريت',   // 🆕 يجب أن يطابق name في serviceTranslations حرفياً
];
```

#### ب) edit-core.js — `servicesMapping` و `customTagsMapping`
هذه مسؤولة عن توليد `search_tags` الصحيحة عند إضافة/تعديل معلم من لوحة الأدمن (Edit tools):
```js
const servicesMapping = {
    'electrician': 'فني كهرباء', /* ... */,
    'glass_tech': 'فني زجاج وسكريت', // 🆕 (المفتاح هنا هو اسم الجدول وليس Layer key)
};

const customTagsMapping = {
    'electrician': 'تمديدات كهربائية، صيانة كهرباء، ...',
    'glass_tech': 'زجاج، سكريت، تركيب زجاج، واجهات زجاجية، فك وتركيب، عزل حراري، دبل جلاس', // 🆕
};
```
إذا ما ضفتها، الكود عنده fallback يستخدم اسم الطبقة نفسه بدون كلمات بحث إضافية — يشتغل لكن بحث أضعف.

#### ج) quick-search.js و no-map-search.js — `iconMap`
اختيارية (فيها fallback لأيقونة عامة `fa-question-circle` أو `fa-building`)، لكن يفضل تضيفها لشكل أجمل:
```js
const iconMap = {
    'electrician': 'fa-bolt', /* ... */,
    'glass_tech': 'fa-vector-square', // 🆕 أي أيقونة من Font Awesome
};
```

#### د) no-map-search.js — `serviceNames` و `serviceGroupMap`
`serviceNames` هي المصدر الفعلي لأسماء صفحة "البحث بدون خريطة" (منفصلة عن `layers.js`)، فلازم تضيفها هون كمان:
```js
const serviceNames = {
    'electrician': 'فني كهرباء', /* ... */,
    'glass_tech': 'فني زجاج وسكريت', // 🆕
};
```
و`serviceGroupMap` لتحديد أي فرع/تبويب تنتمي له (الفنيين والصيانة، الصحة، المركبات...):
```js
const serviceGroupMap = {
    electrician: 'technicians', /* ... */,
    glass_tech: 'technicians', // 🆕 — ضعها بالفرع المناسب
};
```
إذا نسيتها، الطبقة بتظهر بفرع "متفرقات" (`misc`) تلقائياً كـ fallback — مو خطأ لكن أفضل تصنفها صح.

#### هـ) global-search.js — `layerAliases` و `searchConfig.services.layers`
هذا مسؤول عن **البحث العالمي بالشريط العلوي**:
```js
const layerAliases = {
    'electrician': 'فني كهرباء', /* ... */,
    'glass_tech': 'فني زجاج وسكريت', // 🆕 — لاحظ هنا المفتاح هو اسم الجدول
};

const searchConfig = {
    'services': {
        workspace: 'services',
        layers: [
            'electrician', 'ac_technician', /* ... */,
            'glass_tech' // 🆕 أضف اسم الجدول هنا بالمصفوفة
        ].filter(layerName => !MAP_CONFIG.globalExclusions.includes(layerName))
    }
};
```
بدون هذا التعديل، الطبقة الجديدة **لن تظهر أبداً** في نتائج شريط البحث العلوي (global search)، رغم أنها تظهر عادي بالخريطة والبحث الذكي.

#### و) admin-users.html و admin-users.css (لوحة تعيين مزودي الخدمة)
عشان تقدر تربط مستخدم كـ"مزود خدمة" لهذه الطبقة من لوحة إدارة المستخدمين، أضف اسم الجدول في `serviceLayers`:
```js
const serviceLayers = [
    'electrician', 'ac_technician', /* ... */,
    'glass_tech' // 🆕
];
```
هذه المصفوفة موجودة مكررة بمكانين: داخل `admin-users.html` (function `populateServiceLayers`) وأيضاً commented reference بـ `admin-users.html` القديم — تأكد تعدلها بمكانها الوحيد الفعلي بالملف.

### 6) اختبار كامل
1. أعد تشغيل `server.js` (node) — عشان `ALLOWED_LAYERS` تتحدث.
2. افتح `index.html`، تأكد الطبقة ظاهرة في:
   - لوحة "ظهور/إخفاء الخدمات" (`layer-manager.js` يقرأها تلقائياً من `overlayLayersObj`)
   - "البحث الذكي" (`search.js` يقرأها تلقائياً كذلك)
   - "البحث بدون خريطة" (`no-map-search.js`)
   - الشريط السريع (`quick-search.js`)
   - البحث العالمي بالأعلى
3. جرب إضافة معلم تجريبي من أدوات التحرير (`editBtn`) للتأكد أن `search_tags` تتولد صح.

---

## الجزء الثاني: إضافة طبقة مضلعات جديدة بقاعدة realestate — مثال: المباني (Buildings)

هذه أعقد من طبقة النقاط لأن `editPolygons.js` مكتوب بشكل صريح (hardcoded) لطبقتين فقط: `landLayer` (أراضي) و`locationLayer` (مناطق). فإضافة نوع مضلع ثالث تتطلب تعديل كود JS فعلي، مو بس بيانات إعداد.

### 1) PostgreSQL

```sql
-- في قاعدة realestate
CREATE TABLE public."Buildings" (
    fid           SERIAL PRIMARY KEY,
    geom          geometry(Polygon, 28191),
    building_type varchar(100),     -- سكني/تجاري/صناعي...
    floors        integer,
    gov_a         varchar(255),
    village_a     varchar(255),
    location      varchar(255),
    status        integer DEFAULT 0
);

CREATE INDEX buildings_geom_idx ON public."Buildings" USING GIST (geom);
```

> استخدم `fid` كاسم عمود المعرف (مو `id`) — لأن كل كود العقارات بالمشروع (`edit-wfs.js`, `editPolygons.js`, `server.js`) يميّز العقارات عن الخدمات بالاعتماد على `fid` مقابل `id`.

### 2) GeoServer
نفس خطوات النشر بالأعلى، لكن اختر الستور الخاص بـ `realestate`، وتأكد اسم الطبقة بالضبط `Buildings` (بحرف كبير، لأنه سيُستخدم بالكود كـ `typeName`).

### 3) server.js
```js
const ALLOWED_LAYERS = [
    // ...
    'ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest', 'Buildings' // 🆕
];

function getPoolForLayer(layerName) {
    const realEstateLayers = ['ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest', 'Buildings']; // 🆕
    if (realEstateLayers.includes(layerName)) return realestatePool;
    return servicesPool;
}
```
كرر إضافة `'Buildings'` بكل مكان بـ `server.js` فيه مصفوفة `realEstateLayers` محلية (فيه أكثر من موضع مكرر لنفس المصفوفة داخل `/api/update-service-status` وغيره — دورها كلها).

### 4) config.js
أضف الطبقة ضمن `layers.realestate` أو `layers.helper` حسب طبيعتها (المباني أقرب لـ realestate array لأنها تظهر عند الاقتراب):
```js
realestate: [
    { id: "rentLayer", ... },
    { id: "saleLayer", ... },
    { id: "landLayer", ... },
    { id: "buildingsLayer", workspace: "realestate", name: "Buildings", title: "المباني", style: "window.styleBuildings", maxRes: 0.5, labelThreshold: 0.5 } // 🆕
]
```

### 5) layers.js — ستايل جديد
```js
window.styleBuildings = (f, r) => window.createStyle(f, r, {
    fillColor: 'rgba(120, 120, 120, 1)',
    strokeColor: '#555',
    labelField: 'building_type',
    zoomThresholdForLabel: 0.6
});
```
`window.appLayers` بيتولد تلقائياً من `MAP_CONFIG.layers.realestate` (نفس آلية الأراضي والشقق)، فما في حاجة لأي كود إضافي هون.

### 6) popup.js
أضف الاسم العربي "المباني" لمصفوفة `realEstateLayerNames`:
```js
const realEstateLayerNames = ['شقق الإيجار', 'شقق للبيع', 'الأراضي للبيع', 'المباني']; // 🆕
```

### 7) editPolygons.js — التعديل الأهم (كود، مش إعداد)

هذا الملف حالياً hardcoded لطبقتين فقط. الأماكن التي تحتاج تعديل:

**أ) populatePolygonLayers()** — إضافة الطبقة لقائمة التحرير:
```js
function populatePolygonLayers() {
    if (!layerSelect) return;
    layerSelect.innerHTML = '<option value="">--- اختر طبقة للتحرير ---</option>';
    const allowed = {
        'landLayer': 'طبقة الأراضي للبيع',
        'locationLayer': 'طبقة المناطق',
        'buildingsLayer': 'طبقة المباني' // 🆕
    };
    // ...
}
```

**ب) تعريف حقول المضلع الجديد** (بنفس نمط `fieldsLand`/`fieldsLocation`):
```js
const fieldsBuildings = [
    { name: 'building_type', label: 'نوع المبنى', type: 'select', options: [
        { value: 'سكني', label: 'سكني' },
        { value: 'تجاري', label: 'تجاري' },
        { value: 'صناعي', label: 'صناعي' }
    ]},
    { name: 'floors', label: 'عدد الطوابق', type: 'number' }
];
```

**ج) showAttributeModal() و submitAttributes()** — تعديل شرط اختيار الحقول:
```js
const activeFields = (selectedLayerKey === 'landLayer') ? fieldsLand
                    : (selectedLayerKey === 'buildingsLayer') ? fieldsBuildings // 🆕
                    : fieldsLocation;
```

**د) sendWFS_T()** — هذه الدالة فيها الأصعب، لأنها تحدد `typeName`/`workspace`/الحقول المسموحة بشكل صريح حسب `isRealEstate = (selectedLayerKey === 'landLayer')`. يلزم توسيعها لتتعرف على الطبقة الثالثة:
```js
const isLand = (selectedLayerKey === 'landLayer');
const isBuildings = (selectedLayerKey === 'buildingsLayer');
const workspace = 'realestate';
const typeName = isLand ? 'LandSale' : (isBuildings ? 'Buildings' : 'Location');
```
وبعدين تحديد `finalOrder` (ترتيب الحقول عند insert) و`allowedPropsUpdate` (عند update) بإضافة حالة ثالثة توازي حقول `fieldsBuildings`.

> **خلاصة**: لأي مضلع جديد فوق الاثنين الموجودين، اعتبرها مهمة برمجية فعلية على `editPolygons.js` (مو نسخ إعدادات فقط). إذا بس بدك تعرض الطبقة على الخريطة بدون أدوات تحرير مباشرة من الواجهة (تدير البيانات من QGIS/GeoServer مباشرة)، تقدر توقف عند الخطوة 6 وتتجاهل تعديل `editPolygons.js` بالكامل.

---

## الجزء الثالث: طبقة الطرق الكاملة

الخبر الجيد: **ما في شغل جديد بالكود إطلاقاً**. عندك أصلاً:
- جدول `RoadsTest` بقاعدة `realestate`
- طبقة `roadsLayer` معرّفة بـ `config.js` (`layers.helper`) بستايل `window.roadsStyle`
- أدوات تحرير كاملة جاهزة بـ `editLines.js` (تدعم `RoadsTest` بالاسم مباشرة)
- مضافة أصلاً بـ `ALLOWED_LAYERS` بـ `server.js`

كل اللي عليك: **استيراد بيانات الطرق الكاملة** لنفس جدول `RoadsTest` الموجود (سواء عبر QGIS، أو GeoServer WFS-T، أو أداة "إضافة طريق جديد" بالواجهة). لاحظ بـ `config.js` الطبقة حالياً `visible: false` افتراضياً:
```js
{ id: "roadsLayer", workspace: "realestate", name: "RoadsTest", title: "الطرق", style: "window.roadsStyle", maxRes: 3, visible: false, labelThreshold: 1.5 }
```
غيّرها إلى `visible: true` إذا بدك تظهر افتراضياً بمجرد تحميل الخريطة.

---

## الجزء الرابع: الحذف — نفس الخطوات بالعكس

لحذف أي طبقة (نقطية أو مضلع) بشكل نظيف بدون كسر شيء:

1. **مؤقتاً (الأسهل والأكثر أماناً)**: أضف اسم الجدول (مفتاح الطبقة) إلى `globalExclusions` بـ `config.js`:
   ```js
   globalExclusions: ['cityLayer', 'locationLayer', 'roadsLayer', 'governorateLayer', 'glass_tech']
   ```
   هذا يخفيها فوراً من: الخريطة، البحث الذكي، الشريط السريع، البحث بدون خريطة، البحث العالمي — **بدون حذف الجدول أو أي بيانات**. أفضل خيار لو بدك "توقفها" مؤقتاً فقط.

2. **الحذف الكامل النهائي** (إذا متأكد فعلاً):
   - احذف المدخل من `serviceTranslations` (`layers.js`) أو من `MAP_CONFIG.layers.realestate/helper` (`config.js`).
   - احذف اسمها من: `ALLOWED_LAYERS` و`realEstateLayers` (`server.js`)، `serviceLayerNames`/`realEstateLayerNames` (`popup.js`)، `servicesMapping`/`customTagsMapping` (`edit-core.js`)، `serviceNames`/`serviceGroupMap`/`iconMap` (`no-map-search.js`)، `layerAliases`/`searchConfig` (`global-search.js`)، `serviceLayers` (`admin-users.html`).
   - إذا كانت مضلع مخصص أضفتها لـ `editPolygons.js`، تراجع عن التعديلات هناك (`populatePolygonLayers`, `fieldsX`, `sendWFS_T`).
   - بـ GeoServer: **Layers → اختر الطبقة → Remove**.
   - بـ PostgreSQL: `DROP TABLE public."اسم_الجدول";` (فقط بعد ما تتأكد ما في نسخة احتياطية محتاجها).
   - تحقق أي مستخدم "مزود خدمة" (`service_layer`) بجدول `users` مربوط فيها، لأنه رح يفقد ربطه — إما أزل الربط يدوياً أو أعد تعيينه لطبقة ثانية عبر لوحة إدارة المستخدمين قبل الحذف.

---

## جدول مرجعي سريع — كل الملفات التي قد تحتاج لمسها

| الملف | متى تحتاج تعديله |
|---|---|
| PostgreSQL (CREATE/DROP TABLE) | كل طبقة جديدة/محذوفة |
| GeoServer (Publish/Remove Layer) | كل طبقة جديدة/محذوفة |
| `server.js` → `ALLOWED_LAYERS`, `realEstateLayers` | دائماً |
| `layers.js` → `serviceTranslations` أو `window.styleX` | نقاط (تلقائي) / مضلعات (ستايل يدوي) |
| `config.js` → `layers.realestate/helper`, `globalExclusions` | مضلعات/خطوط، أو أي إخفاء مؤقت |
| `popup.js` → `serviceLayerNames`/`realEstateLayerNames` | كل طبقة (وإلا ما يفتح البوب أب) |
| `edit-core.js` → `servicesMapping`, `customTagsMapping` | نقاط فقط، لتفعيل تحرير + search_tags |
| `editPolygons.js` | مضلعات جديدة غير land/location فقط |
| `quick-search.js`, `no-map-search.js` → `iconMap`, `serviceNames`, `serviceGroupMap` | نقاط، للعرض والتصنيف |
| `global-search.js` → `layerAliases`, `searchConfig` | كل طبقة تريدها بالبحث العالمي |
| `admin-users.html` → `serviceLayers` | نقاط فقط، لربط مزودي خدمة |

---

## نصيحة عملية

قبل ما تسوي أي طبقة جديدة على السيرفر الفعلي (production)، جرب دورة كاملة على نسخة تجريبية محلية أول مرة: جدول واحد بسيط (زي `glass_tech`) → طبّق كل الخطوات بالجزء الأول → تأكد الطبقة شغالة 100% بكل الأماكن → بعدها كرر لباقي الطبقات (سوبرماركت، محلات تجارية، مطاعم، مدارس ورياض أطفال) لأنها نفس النمط بالضبط وبتاخذ وقت أقل بكثير من الأول.
# توثيق وحدة نظم المعلومات الجغرافية (GIS Module Documentation)

## نظرة عامة

وحدة نظم المعلومات الجغرافية (GIS) هي مكون أساسي لمنصة خريطة خدمات فلسطين، وتوفر قدرات الخرائط التفاعلية، وإدارة البيانات المكانية، والتحليل الجغرافي المكاني. تدمج الوحدة OpenLayers لرسم الخرائط من جانب العميل، وPostGIS للعمليات المكانية من جانب الخادم، وGeoServer لخدمات WMS/WFS.

## مجموعة التكنولوجيا

### جانب العميل
- **OpenLayers**: رسم الخرائط والتفاعل
- **Proj4js**: تحويلات نظام الإحداثيات
- **JavaScript مخصص**: وظائف خاصة بـ GIS

### جانب الخادم
- **PostgreSQL + PostGIS**: قاعدة بيانات مكانية
- **GeoServer**: خدمات WMS/WFS
- **وكيل مخصص**: وصول آمن إلى GeoServer

## نظام الإحداثيات المرجعي (CRS)

### CRS الأساسي: EPSG:28191
- **الاسم**: فلسطين 1923 / شبكة فلسطين
- **النوع**: نظام إحداثيات مسقط
- **الوحدات**: متر
- **المنطقة**: منطقة فلسطين
- **الدقة**: عالية للخرائط المحلية

### تحويل الإحداثيات

يستخدم النظام Proj4js لتحويلات الإحداثيات:

```javascript
// شبكة فلسطين إلى WGS84
proj4('EPSG:28191', 'EPSG:4326', [x, y]);

// WGS84 إلى شبكة فلسطين
proj4('EPSG:4326', 'EPSG:28191', [lon, lat]);
```

## تكوين OpenLayers

### تهيئة الخريطة

```javascript
const map = new ol.Map({
    target: 'map',
    layers: [
        // الطبقة الأساسية
        new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            })
        }),
        // طبقات الخدمة
        new ol.layer.Tile({
            source: new ol.source.TileWMS({
                url: '/geoserver-proxy/services/services/wms',
                params: {
                    'LAYERS': 'services:carpenter',
                    'TILED': true
                },
                serverType: 'geoserver'
            })
        })
    ],
    view: new ol.View({
        center: [169157.09, 146272.71], // إحداثيات شبكة فلسطين
        zoom: 10,
        projection: 'EPSG:28191'
    })
});
```

### إدارة الطبقات

#### طبقات WMS (خدمة خرائط الويب)

تُستخدم لرسم بلاطات الخريطة:

```javascript
const wmsLayer = new ol.layer.Tile({
    source: new ol.source.TileWMS({
        url: '/geoserver-proxy/services/workspace/wms',
        params: {
            'LAYERS': 'layer_name',
            'TILED': true,
            'FORMAT': 'image/png'
        },
        serverType: 'geoserver'
    })
});
```

#### طبقات WFS (خدمة الميزات الجغرافية)

تُستخدم لاسترجاع الميزات المتجهة:

```javascript
const vectorSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: function(extent) {
        return '/geoserver-proxy/services/workspace/wfs?' +
            'version=1.1.0&request=GetFeature&typename=workspace:layer_name&' +
            'outputFormat=application/json&srsName=EPSG:28191&' +
            'bbox=' + extent.join(',') + ',EPSG:28191';
    },
    strategy: ol.loadingstrategy.bbox
});

const vectorLayer = new ol.layer.Vector({
    source: vectorSource
});
```

### تفاعلات الخريطة

#### تفاعل النقر

```javascript
map.on('click', function(evt) {
    const coordinate = evt.coordinate;
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
        return feature;
    });
    
    if (feature) {
        // عرض النافذة المنبثقة مع معلومات الميزة
        showPopup(feature, coordinate);
    }
});
```

#### عناصر التحكم في التكبير

```javascript
const zoomControl = new ol.control.Zoom({
    zoomInLabel: '+',
    zoomOutLabel: '-'
});
map.addControl(zoomControl);
```

## تكامل GeoServer

### تكوين GeoServer

- **URL**: http://194.163.174.162:8080/geoserver
- **مساحات العمل**: `services`، `realestate`
- **المصادقة**: المصادقة الأساسية
- **الخدمات**: WMS، WFS، WFS-T

### تكوين الوكيل

تستخدم المنصة وكيل آمن للوصول إلى GeoServer:

```javascript
app.use('/geoserver-proxy', createProxyMiddleware({
    target: process.env.GEOSERVER_TARGET,
    changeOrigin: true,
    pathRewrite: {
        '^/geoserver-proxy': ''
    },
    onProxyReq: (proxyReq, req, res) => {
        // إضافة مصادقة GeoServer
        const auth = Buffer.from(
            `${process.env.GEOSERVER_USER}:${process.env.GEOSERVER_PASSWORD}`
        ).toString('base64');
        proxyReq.setHeader('Authorization', `Basic ${auth}`);
    }
}));
```

### WFS-T (WFS المعاملاتي)

لتحرير الميزات:

```javascript
// تحديث الميزة
const transaction = `
<wfs:Transaction service="WFS" version="1.1.0"
    xmlns:wfs="http://www.opengis.net/wfs"
    xmlns:ogc="http://www.opengis.net/ogc">
    <wfs:Update typeName="workspace:layer_name">
        <wfs:Property>
            <wfs:Name>status</wfs:Name>
            <wfs:Value>0</wfs:Value>
        </wfs:Property>
        <ogc:Filter>
            <ogc:PropertyIsEqualTo>
                <ogc:PropertyName>id</ogc:PropertyName>
                <ogc:Literal>${featureId}</ogc:Literal>
            </ogc:PropertyIsEqualTo>
        </ogc:Filter>
    </wfs:Update>
</wfs:Transaction>
`;

fetch('/geoserver-proxy/services/workspace/wfs', {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: transaction
});
```

## العمليات المكانية PostGIS

### الاستعلامات المكانية

#### استعلام BBOX

```sql
SELECT * FROM carpenter
WHERE ST_Intersects(
    geom,
    ST_MakeEnvelope(minX, minY, maxX, maxY, 28191)
);
```

#### استعلام المسافة

```sql
SELECT * FROM carpenter
WHERE ST_DWithin(
    geom,
    ST_SetSRID(ST_MakePoint(x, y), 28191),
    1000  -- 1000 متر
)
ORDER BY ST_Distance(
    geom,
    ST_SetSRID(ST_MakePoint(x, y), 28191)
);
```

#### أقرب جار

```sql
SELECT * FROM carpenter
ORDER BY geom <-> ST_SetSRID(ST_MakePoint(x, y), 28191)
LIMIT 1;
```

### الفهارس المكانية

جميع الجداول المكانية تتضمن فهارس GIST:

```sql
CREATE INDEX idx_carpenter_geom 
ON carpenter USING GIST (geom);

CREATE INDEX idx_carpenter_geom_status 
ON carpenter USING GIST (geom) 
WHERE status = 0;
```

### الدوال المكانية

#### الحصول على الإحداثيات

```sql
SELECT 
    id,
    name,
    ST_X(geom) as x_coord,
    ST_Y(geom) as y_coord
FROM carpenter
WHERE id = 14;
```

#### تحديث الموقع

```sql
UPDATE carpenter
SET geom = ST_SetSRID(ST_MakePoint(x, y), 28191)
WHERE id = 14;
```

#### استعلام المخزن المؤقت

```sql
SELECT * FROM carpenter
WHERE ST_Intersects(
    geom,
    ST_Buffer(
        ST_SetSRID(ST_MakePoint(x, y), 28191),
        500  -- مخزن مؤقت 500 متر
    )
);
```

## طبقات الخدمة

### بنية طبقة الخدمة

لكل نوع خدمة جدول خاص به مع بيانات مكانية:

```sql
CREATE TABLE carpenter (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255),
    phone VARCHAR(20),
    whatsapp VARCHAR(20),
    status INTEGER DEFAULT 0,
    x_coord NUMERIC,
    y_coord NUMERIC,
    geom GEOMETRY(Point, 28191)
);

CREATE INDEX idx_carpenter_geom 
ON carpenter USING GIST (geom);
```

### طبقات الخدمة المتاحة

- **carpenter**: خدمات النجارة
- **electrician**: خدمات الكهرباء
- **plumber**: خدمات السباكة
- **painter**: خدمات الدهان
- **mechanic**: خدمات الميكانيكا
- **taxi_on_call**: خدمات التاكسي
- **private_tutors**: التدريب الخصوصي
- **music_training**: التدريب الموسيقي
- **lawyers**: الخدمات القانونية
- **clinics**: العيادات الطبية
- **programmers**: خدمات البرمجة
- **land_surveyors**: مسح الأراضي
- **student_research_assist**: مساعدة البحث
- **car_delivery_on_call**: توصيل السيارات
- **motorcycle_delivery_on_call**: توصيل الدراجات النارية
- **bicycle_delivery_on_call**: توصيل الدراجات

### طبقات العقارات

- **ApartRent**: شقق للإيجار
- **ApartSale**: شقق للبيع
- **LandSale**: أراضٍ للبيع

## ميزات الخريطة

### النافذة المنبثقة للميزة

```javascript
function showPopup(feature, coordinate) {
    const properties = feature.getProperties();
    const content = `
        <div class="popup-content">
            <h3>${properties.name}</h3>
            <p>الهاتف: ${properties.phone}</p>
            <p>واتساب: ${properties.whatsapp}</p>
            <button onclick="requestService(${properties.id})">
                طلب الخدمة
            </button>
        </div>
    `;
    
    const popup = new ol.Overlay({
        element: document.createElement('div'),
        position: coordinate,
        autoPan: true
    });
    
    popup.getElement().innerHTML = content;
    map.addOverlay(popup);
}
```

### تنسيق الميزة

```javascript
const styleFunction = function(feature) {
    const status = feature.get('status');
    let color = status === 0 ? '#00ff00' : '#ff0000';
    
    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: 7,
            fill: new ol.style.Fill({ color: color }),
            stroke: new ol.style.Stroke({ color: '#000', width: 2 })
        }),
        text: new ol.style.Text({
            text: feature.get('name'),
            font: '12px Arial',
            fill: new ol.style.Fill({ color: '#000' })
        })
    });
};

vectorLayer.setStyle(styleFunction);
```

### تجميع الميزات

```javascript
const clusterSource = new ol.source.Cluster({
    distance: 40,
    source: vectorSource
});

const clusterLayer = new ol.layer.Vector({
    source: clusterSource,
    style: function(feature) {
        const size = feature.get('features').length;
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: 10 + (size * 2),
                stroke: new ol.style.Stroke({ color: '#fff' }),
                fill: new ol.style.Fill({ color: '#3399cc' })
            }),
            text: new ol.style.Text({
                text: size.toString(),
                fill: new ol.style.Fill({ color: '#fff' })
            })
        });
    }
});
```

## التحليل المكاني

### تحليل منطقة الخدمة

```sql
-- البحث عن جميع المزودين ضمن 1 كم من نقطة
SELECT 
    c.*,
    ST_Distance(
        c.geom,
        ST_SetSRID(ST_MakePoint(x, y), 28191)
    ) as distance
FROM carpenter c
WHERE ST_DWithin(
    c.geom,
    ST_SetSRID(ST_MakePoint(x, y), 28191),
    1000
)
ORDER BY distance;
```

### تحليل الكثافة

```sql
-- عدد المزودين لكل منطقة
SELECT 
    COUNT(*) as provider_count,
    ST_Summary(ST_Union(geom)) as area_geom
FROM carpenter
WHERE status = 0
GROUP BY ST_SnapToGrid(geom, 1000);
```

### تحليل المسار (مستقبلاً)

```sql
-- البحث عن أقصر مسار بين نقطتين
SELECT 
    seq,
    node,
    edge,
    cost,
    agg_cost
FROM pgr_dijkstra(
    'SELECT id as id, source, target, cost FROM roads',
    start_node,
    end_node,
    directed := false
);
```

## أدوات الخريطة

### أدوات القياس

#### قياس المسافة

```javascript
const measureSource = new ol.source.Vector();
const measureLayer = new ol.layer.Vector({
    source: measureSource,
    style: new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#ff0000',
            width: 2
        })
    })
});

let sketch;
const draw = new ol.interaction.Draw({
    source: measureSource,
    type: 'LineString'
});

draw.on('drawend', function(evt) {
    const geometry = evt.feature.getGeometry();
    const length = geometry.getLength();
    console.log('المسافة:', length, 'متر');
});
```

#### قياس المساحة

```javascript
const areaDraw = new ol.interaction.Draw({
    source: measureSource,
    type: 'Polygon'
});

areaDraw.on('drawend', function(evt) {
    const geometry = evt.feature.getGeometry();
    const area = ol.sphere.getArea(geometry);
    console.log('المساحة:', area, 'متر مربع');
});
```

### أدوات البحث

#### البحث بالسمة

```javascript
function searchByAttribute(layer, field, value) {
    const features = vectorSource.getFeatures();
    const results = features.filter(feature => {
        return feature.get(field) === value;
    });
    
    // التكبير على النتائج
    if (results.length > 0) {
        const extent = ol.extent.createEmpty();
        results.forEach(feature => {
            ol.extent.extend(extent, feature.getGeometry().getExtent());
        });
        map.getView().fit(extent);
    }
}
```

#### البحث المكاني

```javascript
function searchByBBOX(minX, minY, maxX, maxY) {
    const bbox = [minX, minY, maxX, maxY];
    const features = vectorSource.getFeaturesInExtent(bbox);
    
    // تمييز النتائج
    features.forEach(feature => {
        feature.setStyle(highlightStyle);
    });
}
```

## تحسين الأداء

### تخزين البلاطات المؤقت

```javascript
const tileLayer = new ol.layer.Tile({
    source: new ol.source.TileWMS({
        url: '/geoserver-proxy/services/services/wms',
        params: {
            'LAYERS': 'carpenter',
            'TILED': true
        },
        tileLoadFunction: function(imageTile, src) {
            // تخزين البلاطات مؤقتاً
            const cached = cache.get(src);
            if (cached) {
                imageTile.getImage().src = cached;
            } else {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                    cache.set(src, img.src);
                    imageTile.getImage().src = img.src;
                };
                img.src = src;
            }
        }
    })
});
```

### استراتيجية تحميل المتجهات

```javascript
const vectorSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: function(extent) {
        return '/api/search-features?' +
            'layer=carpenter&workspace=services&' +
            'field=name&operator==&value=*&' +
            'bbox=' + extent.join(',') + ',EPSG:28191';
    },
    strategy: ol.loadingstrategy.bbox
});
```

### تحسين الفهرس المكاني

```sql
-- إنشاء فهرس جزئي للمزودين النشطين
CREATE INDEX idx_carpenter_active_geom 
ON carpenter USING GIST (geom) 
WHERE status = 0;

-- تجميع الجدول حسب الهندسة
CLUSTER carpenter USING idx_carpenter_geom;
```

## اعتبارات الأمان

### أمان GeoServer

- المصادقة الأساسية لجميع الطلبات
- طبقة الوكيل لإخفاء بيانات الاعتماد
- القائمة البيضاء لعناوين IP (إذا لزم الأمر)
- تحديد المعدل على الوكيل

### أمان البيانات

- حماية بيانات الموقع الحساسة
- التحكم في الوصول للبيانات المكانية
- تسجيل تدقيق الاستعلامات المكانية
- تشفير الإحداثيات الحساسة

## معالجة الأخطاء

### أخطاء تهيئة الخريطة

```javascript
try {
    const map = new ol.Map({
        target: 'map',
        // ... التكوين
    });
} catch (error) {
    console.error('فشلت تهيئة الخريطة:', error);
    showErrorMessage('فشل في تحميل الخريطة');
}
```

### أخطاء الاستعلام المكاني

```javascript
try {
    const result = await fetch('/api/search-features?' + params);
    const data = await result.json();
    
    if (!data.success) {
        throw new Error(data.error);
    }
    
    // معالجة الميزات
} catch (error) {
    console.error('فشل الاستعلام المكاني:', error);
    showErrorMessage('فشل البحث');
}
```

## التحسينات المستقبلية

### ميزات GIS المخطط لها

- **التوجيه**: العثور على المسار بين المواقع
- **الترميز الجغرافي**: تحويل العنوان إلى إحداثيات
- **الترميز الجغرافي العكسي**: تحويل الإحداثيات إلى عنوان
- **خرائط الحرارة**: تصور كثافة المزود
- **التحليل القائم على الوقت**: الأنماط المكانية الزمنية
- **التصور ثلاثي الأبعاد**: عرض المباني ثلاثي الأبعاد
- **الخرائط غير المتصلة**: قدرات الخرائط غير المتصلة
- **التتبع في الوقت الفعلي**: تتبع موقع المزود

### التحسينات التقنية

- **البلاطات المتجهة**: تحسين الأداء
- **عرض WebGL**: تسريع الأجهزة
- **تجزئة قاعدة البيانات المكانية**: القابلية للتوسع
- **طبقة التخزين المؤقت**: Redis للاستعلامات المكانية
- **تكامل CDN**: تحميل الخريطة أسرع

## استكشاف الأخطاء وإصلاحها

### المشاكل الشائعة

#### الخريطة لا تحمل

1. تحقق من اتصال GeoServer
2. تحقق من تكوين الوكيل
3. تحقق من اتصال الشبكة
4. تحقق من أسماء الطبقات

#### الميزات لا تعرض

1. تحقق من توافق CRS
2. تحقق من البيانات المكانية
3. تحقق من رؤية الطبقة
4. تحقق من معلمات الفلتر

#### مشاكل الأداء

1. تحقق من الفهارس المكانية
2. حسّن معلمات الاستعلام
3. قلل عدد الميزات
4. مكن تخزين البلاطات مؤقتاً

#### أخطاء تحويل الإحداثيات

1. تحقق من تعريفات CRS
2. تحقق من تكوين Proj4js
3. تحقق من صحة قيم الإحداثيات
4. تحقق من معلمات التحويل

## أفضل الممارسات

### تصميم الخريطة

- استخدم مستويات التكبير المناسبة
- قدم وسائل إيضاح واضحة
- تأكد من تباين جيد
- استخدم رموزاً بديهية
- قدم مؤشرات المقياس

### الاستعلامات المكانية

- استخدم الفهارس المكانية
- حدد مدى الاستعلام
- حسّن شروط الفلتر
- خزن الاستعلامات المتكررة مؤقتاً
- راقب أداء الاستعلام

### إدارة البيانات

- التحقق من صحة البيانات بانتظام
- نسخ احتياطي للبيانات المكانية
- راقب جودة البيانات
- تحديث البيانات الوصفية
- وثق مصادر البيانات

---

**آخر تحديث**: 29 يوليو 2026  
**الإصدار**: 1.0.0  
**الصيانة بواسطة**: فريق التطوير

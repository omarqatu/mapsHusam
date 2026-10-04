# دليل الواجهة الأمامية (Frontend Guide)

## نظرة عامة

يقدم هذا المستند إرشادات شاملة لتطوير وصيانة الواجهة الأمامية لمنصة خريطة خدمات فلسطين. يغطي كل من واجهة React الأمامية والواجهة الأمامية القديمة بـ JavaScript العادي.

## بنية الواجهة الأمامية

### مجموعة التكنولوجيا

#### واجهة React الأمامية (الحديثة)
- **الإطار**: React مع Vite
- **أداة البناء**: Vite
- **المنفذ**: 5173 (التطوير)
- **إدارة الحالة**: React hooks + الحالة المحلية
- **الوقت الفعلي**: عميل Socket.io

#### الواجهة الأمامية القديمة
- **التكنولوجيا**: JavaScript العادي
- **مكتبة الخريطة**: OpenLayers
- **المنفذ**: 3000 (يقدمه Express)
- **المكونات**: ملفات JavaScript معيارية

### هيكل المشروع

```
frontend-react/
├── public/
│   ├── index.html              # HTML المدخل
│   ├── js/                     # وحدات الواجهة الأمامية
│   │   ├── service-chat.js     # وظيفة المحادثة
│   │   ├── notifications.js    # معالجة الإشعارات
│   │   ├── popup.js            # منطق النافذة المنبثقة للخريطة
│   │   ├── shared-utils.js    # الأدوات المساعدة المشتركة
│   │   └── provider-panel.js   # إدارة المزود
│   └── css/                    # أوراق الأنماط
├── src/                        # مصدر React (إذا تم استخدامه)
├── index.html                  # HTML المدخل
├── package.json                # التبعيات
└── vite.config.js              # تكوين Vite
```

## تطوير واجهة React الأمامية

### البدء

#### التثبيت

```bash
cd frontend-react
npm install
```

#### خادم التطوير

```bash
npm run dev
```

سوف يبدأ خادم التطوير على المنفذ 5173 (أو 5174 إذا كان مشغولاً).

#### البناء للإنتاج

```bash
npm run build
```

سيتم إنشاء بناء الإنتاج في دليل `dist`.

### تطوير المكونات

#### بنية مكون React

```javascript
import React, { useState, useEffect } from 'react';

function MapComponent() {
    const [map, setMap] = useState(null);
    const [features, setFeatures] = useState([]);

    useEffect(() => {
        // تهيئة الخريطة
        const mapInstance = new ol.Map({
            target: 'map',
            layers: [/* ... */],
            view: new ol.View({
                center: [169157.09, 146272.71],
                zoom: 10
            })
        });
        setMap(mapInstance);

        return () => {
            mapInstance.setTarget(null);
        };
    }, []);

    return <div id="map" style={{ width: '100%', height: '100vh' }} />;
}

export default MapComponent;
```

#### إدارة الحالة

```javascript
import { useState, useContext, createContext } from 'react';

// السياق للحالة العامة
const AppContext = createContext();

function AppProvider({ children }) {
    const [user, setUser] = useState(null);
    const [notifications, setNotifications] = useState([]);

    return (
        <AppContext.Provider value={{ user, setUser, notifications, setNotifications }}>
            {children}
        </AppContext.Provider>
    );
}

// استخدام السياق في المكونات
function MyComponent() {
    const { user, setUser } = useContext(AppContext);
    // ...
}
```

### تكامل واجهة برمجة التطبيقات

#### Fetch API

```javascript
async function fetchServiceRequests(userId) {
    try {
        const response = await fetch(`/api/service-requests?user_id=${userId}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        return data.requests;
    } catch (error) {
        console.error('فشل في جلب الطلبات:', error);
        throw error;
    }
}
```

#### Axios (إذا تمت إضافته)

```javascript
import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

// إضافة المصادقة
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// استخدام واجهة برمجة التطبيقات
async function getServiceRequests(userId) {
    const response = await api.get('/service-requests', {
        params: { user_id: userId }
    });
    return response.data.requests;
}
```

### تكامل Socket.io

#### إعداد الاتصال

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
    auth: {
        token: localStorage.getItem('token')
    }
});

socket.on('connect', () => {
    console.log('متصل بالخادم');
});

socket.on('disconnect', () => {
    console.log('منفصل من الخادم');
});
```

#### معالجة الأحداث

```javascript
// الاستماع لطلبات الخدمة الجديدة
socket.on('service_request_new', (data) => {
    console.log('طلب خدمة جديد:', data);
    // معالجة الطلب الجديد
});

// الاستماع لردود الطلبات
socket.on('service_request_response', (data) => {
    console.log('رد الطلب:', data);
    // معالجة الرد
});

// الاستماع لرسائل المحادثة
socket.on('service_request_message', (data) => {
    console.log('رسالة جديدة:', data);
    // معالجة الرسالة
});

// إرسال الأحداث
socket.emit('join_room', { room: `user_${userId}` });
```

## تطوير الواجهة الأمامية القديمة

### بنية الوحدة

#### وحدة المحادثة (`service-chat.js`)

```javascript
// الوظيفة الرئيسية للمحادثة
(function() {
    'use strict';
    
    // متغيرات الحالة
    let currentOpenRequestId = null;
    let currentUserRoleInChat = null;
    let chatModal = null;
    
    // التهيئة
    function init() {
        buildUI();
        setupEventListeners();
    }
    
    // بناء مكونات واجهة المستخدم
    function buildUI() {
        // إنشاء نافذة المحادثة المنبثقة
        // إنشاء بانر الإشعار
        // إنشاء لوحة المزود
    }
    
    // إعداد مستمعي الأحداث
    function setupEventListeners() {
        document.addEventListener('serviceRequestNew', handleNewRequest);
        document.addEventListener('serviceRequestResponse', handleResponse);
        document.addEventListener('serviceRequestCompleted', handleCompletion);
    }
    
    // التهيئة عند جاهزية DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
```

#### وحدة الإشعارات (`notifications.js`)

```javascript
// معالجة الإشعارات
(function() {
    'use strict';
    
    let socket = null;
    
    function init() {
        connectSocket();
        setupNotificationListeners();
    }
    
    function connectSocket() {
        socket = io('http://localhost:3000');
        
        socket.on('connect', () => {
            console.log('المقبس متصل');
        });
        
        socket.on('notification', (data) => {
            showNotification(data);
        });
    }
    
    function showNotification(data) {
        // عرض الإشعار للمستخدم
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = data.message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
    
    init();
})();
```

### تكامل الخريطة

#### تهيئة خريطة OpenLayers

```javascript
function initMap() {
    const map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([34.5, 31.5]),
            zoom: 10
        })
    });
    
    return map;
}
```

#### تحميل الطبقة المخصصة

```javascript
function loadServiceLayer(layerName) {
    const vectorSource = new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: function(extent) {
            return `/api/search-features?layer=${layerName}&bbox=${extent.join(',')}`;
        },
        strategy: ol.loadingstrategy.bbox
    });
    
    const vectorLayer = new ol.layer.Vector({
        source: vectorSource,
        style: function(feature) {
            return new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({ color: '#00ff00' }),
                    stroke: new ol.style.Stroke({ color: '#000', width: 2 })
                })
            });
        }
    });
    
    map.addLayer(vectorLayer);
}
```

## التنسيق

### تنظيم CSS

#### هيكل الملف

```
css/
├── main.css              # ورقة الأنماط الرئيسية
├── map.css               # أنماط الخريطة الخاصة
├── chat.css              # أنماط مكون المحادثة
├── notifications.css      # أنماط الإشعارات
└── provider-panel.css    # أنماط لوحة المزود
```

#### أفضل ممارسات CSS

```css
/* استخدام اتفاقية تسمية BEM */
.map__container {
    width: 100%;
    height: 100vh;
}

.map__layer--active {
    opacity: 1;
}

.chat__message {
    padding: 10px;
    margin: 5px 0;
}

.chat__message--sent {
    background-color: #007bff;
    color: white;
}

.chat__message--received {
    background-color: #f1f1f1;
    color: black;
}
```

### التصميم المتجاوب

```css
/* نهج الهاتف أولاً */
@media (max-width: 768px) {
    .map__container {
        height: 60vh;
    }
    
    .chat__modal {
        width: 100%;
        height: 40vh;
        bottom: 0;
        top: auto;
    }
}

@media (min-width: 769px) and (max-width: 1024px) {
    .map__container {
        height: 70vh;
    }
}

@media (min-width: 1025px) {
    .map__container {
        height: 100vh;
    }
}
```

## تحسين الأداء

### تقسيم الكود

```javascript
// الاستيرادات الديناميكية لتقسيم الكود
const MapComponent = lazy(() => import('./components/MapComponent'));
const ChatComponent = lazy(() => import('./components/ChatComponent'));

function App() {
    return (
        <Suspense fallback={<div>جاري التحميل...</div>}>
            <MapComponent />
            <ChatComponent />
        </Suspense>
    );
}
```

### التحميل الكسول

```javascript
// تحميل كسول لمكونات الخريطة
document.getElementById('load-map').addEventListener('click', async () => {
    const { initMap } = await import('./map.js');
    initMap();
});
```

### تحسين الصور

```html
<!-- استخدام تنسيق WebP -->
<picture>
    <source srcset="image.webp" type="image/webp">
    <img src="image.jpg" alt="صورة محسنة" loading="lazy">
</picture>
```

## الاختبار

### اختبار الوحدة

```javascript
// مثال باستخدام Jest
import { render, screen } from '@testing-library/react';
import MapComponent from './MapComponent';

test('يعرض حاوية الخريطة', () => {
    render(<MapComponent />);
    const mapElement = screen.getByTestId('map-container');
    expect(mapElement).toBeInTheDocument();
});
```

### اختبار التكامل

```javascript
// اختبار تكامل واجهة برمجة التطبيقات
test('يجلب طلبات الخدمة', async () => {
    const requests = await fetchServiceRequests(123);
    expect(requests).toBeInstanceOf(Array);
});
```

## التصحيح

### أدوات مطور المتصفح

#### تسجيل وحدة التحكم

```javascript
console.log('معلومات التصحيح:', data);
console.warn('تحذير:', warning);
console.error('خطأ:', error);
```

#### مراقبة الشبكة

1. افتح DevTools (F12)
2. انتقل إلى تبويب الشبكة
3. راقب طلبات واجهة برمجة التطبيقات
4. تحقق من أوقات الاستجابة وأكواد الحالة

#### ملف الأداء

1. افتح DevTools (F12)
2. انتقل إلى تبويب الأداء
3. سجل تفاعلات المستخدم
4. حلل اختناقات الأداء

### React DevTools

#### التثبيت

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

#### الاستخدام

- فحص تسلسل المكونات
- عرض الخصائص والحالة
- ملف أداء المكون
- تصحيح إعادة العرض

## أفضل الممارسات

### تنظيم الكود

1. **بنية قائمة على المكونات**: قسّم واجهة المستخدم إلى مكونات قابلة لإعادة الاستخدام
2. **فصل الاهتمامات**: افصل المنطق عن العرض
3. **ملفات معيارية**: مكون واحد لكل ملف
4. **تسمية متسقة**: استخدم أسماء واضحة ووصفية

### الأداء

1. **التحميل الكسول**: قم بتحميل المكونات فقط عند الحاجة
2. **التخزين المؤقت**: استخدم React.memo للمكونات المكلفة
3. **التنحي**: تنحِ الأحداث المتكررة (البحث، التمرير)
4. **الافتراضية**: استخدم القوائم الافتراضية لمجموعات البيانات الكبيرة

### الأمان

1. **التحقق من صحة الإدخال**: تحقق من صحة جميع مدخلات المستخدم
2. **منع XSS**: نظف المحتوى الذي ينشئه المستخدم
3. **حماية CSRF**: استخدم رموز anti-CSRF
4. **التخزين الآمن**: استخدم ملفات تعريف الارتباط HttpOnly للبيانات الحساسة

### إمكانية الوصول

1. **HTML الدلالي**: استخدم عناصر HTML المناسبة
2. **تسميات ARIA**: أضف تسميات ARIA لقارئات الشاشة
3. **التنقل بلوحة المفاتيح**: تأكد من إمكانية الوصول بلوحة المفاتيح
4. **تباين الألوان**: حافظ على تباين ألوان كافٍ

## استكشاف الأخطاء وإصلاحها

### المشاكل الشائعة

#### الخريطة لا تحمل

1. تحقق من تهيئة OpenLayers
2. تحقق من اتصال GeoServer
3. تحقق من وحدة تحكم المتصفح للأخطاء
4. تحقق من تكوين الطبقة

#### فشل اتصال Socket.io

1. تحقق من تشغيل الخادم
2. تحقق من عنوان URL خادم Socket.io
3. تحقق من اتصال الشبكة
4. تحقق من رمز المصادقة

#### أخطاء بناء React

1. تحقق من أخطاء بناء الجملة
2. تحقق من تثبيت التبعيات
3. تحقق من التبعيات المتضاربة
4. امسح node_modules وأعد التثبيت

#### مشاكل التنسيق

1. تحقق من استيراد ملفات CSS
2. تحقق من تحديد CSS
3. تحقق من الأنماط المتضاربة
4. استخدم DevTools المتصفح للفحص

## سير العمل للتطوير

### سير عمل Git

```bash
# إنشاء فرع ميزة
git checkout -b feature/new-feature

# إجراء التغييرات
git add .
git commit -m "إضافة ميزة جديدة"

# الدفع إلى البعيد
git push origin feature/new-feature

# إنشاء طلب سحب
# المراجعة والدمج
```

### قائمة مراجعة الكود

- [ ] الكود يتبع إرشادات النمط
- [ ] المكونات موثقة بشكل صحيح
- [ ] لا توجد عبارات console.log في كود الإنتاج
- [ ] معالجة الأخطاء مطبقة
- [ ] الأداء محسّن
- [ ] إمكانية الوصول مُعتبرة
- [ ] أفضل ممارسات الأمان متبعة
- [ ] الاختبارات مشمولة
- [ ] التوثيق محدث

---

**آخر تحديث**: 29 يوليو 2026  
**الإصدار**: 1.0.0  
**الصيانة بواسطة**: فريق التطوير

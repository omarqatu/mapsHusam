# توثيق نظام العناصر الحيوية - دليل تحديث البيانات عبر API

## 📋 نظرة عامة

يحتوي نظام العناصر الحيوية على 8 عناصر رئيسية يمكن تحديث بياناتها عبر API. هذا الدليل يشرح كيفية ربط النظام بـ API الخاص بك وكيفية تحديث البيانات يدوياً.

## 🎯 العناصر الثمانية

1. **أسعار العملات المباشرة** - USD, JOD, EUR, GBP مقابل ILS
2. **أسعار الذهب والمعادن النفيسة** - عيارات 24، 21، 18 + أونصة الذهب عالمياً
3. **حالة الطقس المحدثة** - رام الله، غزة، القدس، نابلس، بيت لحم
4. **أسعار المحروقات والغاز** - بنزين 95، 98، سولار، أسطوانة غاز
5. **مواقيت الصلاة** - الفجر، الظهر، العصر، المغرب، العشاء
6. **التقويم الهجري والميلادي** - مع المناسبات الدينية
7. **حالة الطرق والحركة المرورية** - الحواجز والطرق الرئيسية
8. **مؤشرات الأسواق المالية** - تل أبيب، الذهب، النفط

## 🔗 هيكل API المطلوب

### 1. أسعار العملات

**Endpoint:** `/api/currency-rates`
**Method:** `GET`
**Response Format:**
```json
{
    "usd_ils": 3.45,
    "jod_ils": 4.86,
    "eur_ils": 3.72,
    "gbp_ils": 4.38,
    "last_updated": "2026-08-17T12:00:00Z"
}
```

**كيفية التحديث اليدوي:**
- قم بتعديل القيم في ملف `widgets-ticker.js` في دالة `fetchCurrencyData()`
- أو قم بإنشاء endpoint في الـ backend يقوم بإرجاع البيانات الحالية

### 2. أسعار الذهب

**Endpoint:** `/api/gold-prices`
**Method:** `GET`
**Response Format:**
```json
{
    "gold_24": 215.5,
    "gold_21": 188.5,
    "gold_18": 161.5,
    "gold_ounce": 2450,
    "silver": 28.50,
    "last_updated": "2026-08-17T12:00:00Z"
}
```

**كيفية التحديث اليدوي:**
- قم بتعديل القيم في ملف `widgets-ticker.js` في دالة `fetchGoldData()`
- أو قم بإنشاء endpoint في الـ backend يقوم بإرجاع البيانات الحالية

### 3. حالة الطقس

**Endpoint:** `/api/weather`
**Method:** `GET`
**Response Format:**
```json
{
    "ramallah": {
        "temp": 28,
        "humidity": 65,
        "wind": 12,
        "condition": "غائم جزئياً"
    },
    "gaza": {
        "temp": 32,
        "humidity": 70,
        "wind": 15,
        "condition": "مشمس"
    },
    "jerusalem": {
        "temp": 26,
        "humidity": 60,
        "wind": 10,
        "condition": "غائم"
    },
    "nablus": {
        "temp": 27,
        "humidity": 62,
        "wind": 11,
        "condition": "غائم جزئياً"
    },
    "bethlehem": {
        "temp": 25,
        "humidity": 58,
        "wind": 9,
        "condition": "غائم جزئياً"
    },
    "last_updated": "2026-08-17T12:00:00Z"
}
```

**ملاحظه:** هذه البيانات عادة تأتي من خدمة طقس خارجية مثل OpenWeatherMap

### 4. أسعار المحروقات

**Endpoint:** `/api/fuel-prices`
**Method:** `GET`
**Response Format:**
```json
{
    "benzine_95": 6.85,
    "benzine_98": 7.05,
    "diesel": 6.25,
    "gas": 35.00,
    "last_updated": "2026-08-01T00:00:00Z"
}
```

**كيفية التحديث اليدوي (مثال: تغيير سعر السولار):**
```javascript
// في ملف widgets-ticker.js
function fetchFuelData() {
    // بدلاً من استخدام API، يمكنك تعديل القيم مباشرة
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                benzine_95: 6.85,    // عدل هذا الرقم حسب السعر الجديد
                benzine_98: 7.05,    // عدل هذا الرقم حسب السعر الجديد
                diesel: 6.50,       // ← عدل سعر السولار هنا
                gas: 35.00           // عدل سعر الغاز هنا
            });
        }, 500);
    });
}
```

**أو إنشاء endpoint في الـ backend:**
```php
// مثال في PHP
<?php
header('Content-Type: application/json');
echo json_encode([
    'benzine_95' => 6.85,
    'benzine_98' => 7.05,
    'diesel' => 6.50,  // السعر الجديد للسولار
    'gas' => 35.00,
    'last_updated' => date('c')
]);
?>
```

### 5. مواقيت الصلاة

**Endpoint:** `/api/prayer-times`
**Method:** `GET`
**Response Format:**
```json
{
    "fajr": "04:45",
    "dhuhr": "12:30",
    "asr": "15:45",
    "maghrib": "18:45",
    "isha": "20:15",
    "date": "2026-08-17",
    "location": "Palestine"
}
```

**ملاحظة:** هذه البيانات عادة تأتي من خدمة مواقيت الصلاة مثل Aladhan API

### 6. التقويم الهجري والميلادي

**Endpoint:** `/api/calendar`
**Method:** `GET`
**Response Format:**
```json
{
    "hijri": "12 رجب 1446",
    "gregorian": "2026-08-17",
    "events": [
        {
            "date": "15 شعبان",
            "name": "بداية شهر شعبان"
        },
        {
            "date": "1 رمضان",
            "name": "بداية شهر رمضان المبارك"
        }
    ],
    "last_updated": "2026-08-17T00:00:00Z"
}
```

**ملاحظة:** هذه البيانات عادة تأتي من خدمة تقويم هجري مثل IslamicFinder

### 7. حالة الطرق والحركة المرورية

**Endpoint:** `/api/traffic`
**Method:** `GET`
**Response Format:**
```json
{
    "qalandia": {
        "status": "ازدحام",
        "delay": 15
    },
    "road60": {
        "status": "سلس",
        "delay": 0
    },
    "hawara": {
        "status": "طبيعي",
        "delay": 5
    },
    "rafah": {
        "status": "مغلق جزئياً",
        "delay": null
    },
    "last_updated": "2026-08-17T12:30:00Z"
}
```

**ملاحظة:** هذه البيانات تحتاج إلى تحديث يدوي من قبل المسؤولين أو من مصادر محلية

### 8. مؤشرات الأسواق المالية

**Endpoint:** `/api/market-data`
**Method:** `GET`
**Response Format:**
```json
{
    "telaviv": {
        "value": 1850,
        "change": "+1.2%"
    },
    "gold": {
        "value": 2450,
        "change": "+0.5%"
    },
    "oil": {
        "value": 78.50,
        "change": "-0.3%"
    },
    "last_updated": "2026-08-17T16:00:00Z"
}
```

**ملاحظة:** هذه البيانات عادة تأتي من خدمات مالية مثل Yahoo Finance أو Alpha Vantage

## 🔧 تفعيل API في النظام

### الخطوة 1: تعديل ملف `widgets-ticker.js`

ابحث عن دالة `CONFIG` في بداية الملف وقم بتعديل الـ endpoints:

```javascript
const CONFIG = {
    updateInterval: 60000, // تحديث كل دقيقة
    apiEndpoints: {
        currency: '/api/currency-rates',      // عدل هذا الرابط
        gold: '/api/gold-prices',             // عدل هذا الرابط
        weather: '/api/weather',              // عدل هذا الرابط
        fuel: '/api/fuel-prices',            // عدل هذا الرابط
        prayer: '/api/prayer-times',         // عدل هذا الرابط
        calendar: '/api/calendar',           // عدل هذا الرابط
        traffic: '/api/traffic',             // عدل هذا الرابط
        market: '/api/market-data'           // عدل هذا الرابط
    },
    palestinianCities: ['رام الله', 'غزة', 'القدس', 'نابلس', 'بيت لحم', 'الخليل']
};
```

### الخطوة 2: تعديل دوال الجلب (Fetch Functions)

لكل عنصر، قم بتعديل دالة الجلب لاستخدام API الحقيقي بدلاً من البيانات المحلية:

**مثال: تعديل دالة جلب أسعار العملات**

```javascript
function fetchCurrencyData() {
    // استخدم API الحقيقي
    return fetch(CONFIG.apiEndpoints.currency)
        .then(response => response.json())
        .then(data => {
            return {
                usd_ils: data.usd_ils,
                jod_ils: data.jod_ils,
                eur_ils: data.eur_ils,
                gbp_ils: data.gbp_ils
            };
        })
        .catch(err => {
            console.error('خطأ في جلب بيانات العملات:', err);
            // استخدام البيانات المحلية كاحتياطي
            return localData.currency;
        });
}
```

## 📝 البيانات الثابتة vs المتغيرة

### البيانات المتغيرة (تحتاج API)
- أسعار العملات - تتغير يومياً
- أسعار الذهب - تتغير يومياً
- حالة الطقس - تتغير ساعة بساعة
- أسعار المحروقات - تتغير شهرياً
- مواقيت الصلاة - تتغير يومياً
- حالة الطرق - تتغير ساعة بساعة
- مؤشرات الأسواق - تتغير دقيقة بدقيقة

### البيانات شبه الثابتة (يمكن تحديثها يدوياً)
- التقويم الهجري والميلادي - تتغير شهرياً
- المناسبات الدينية - محددة مسبقاً

## 🎨 تحديث البيانات يدوياً بدون API

إذا كنت لا تريد استخدام API، يمكنك تعديل البيانات مباشرة في ملف `widgets-ticker.js`:

### مثال: تحديث سعر السولار

1. افتح ملف `js/widgets-ticker.js`
2. ابحث عن دالة `fetchFuelData()`
3. عدل قيمة `diesel`:

```javascript
function fetchFuelData() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                benzine_95: 6.85,
                benzine_98: 7.05,
                diesel: 6.50,  // ← السعر الجديد للسولار
                gas: 35.00
            });
        }, 500);
    });
}
```

4. احفظ الملف
5. قم بتحديث الصفحة في المتصفح

## ⚙️ إعدادات التحديث التلقائي

يمكنك تعديل فترة التحديث التلقائي في ملف `widgets-ticker.js`:

```javascript
const CONFIG = {
    updateInterval: 60000, // بالمللي ثانية
    // 60000 = دقيقة واحدة
    // 300000 = 5 دقائق
    // 600000 = 10 دقائق
    // 3600000 = ساعة واحدة
};
```

## 🔍 اختبار API

يمكنك اختبار الـ endpoints باستخدام:
- Postman
- curl
- المتصفح مباشرة

**مثال باستخدام curl:**
```bash
curl http://your-domain.com/api/currency-rates
```

## 📊 مراقبة الأخطاء

النظام يحتوي على معالجة أخطاء تلقائية:
- إذا فشل الـ API، سيتم استخدام البيانات المحلية
- سيتم تسجيل الأخطاء في Console للمتصفح
- لن يتوقف النظام عن العمل في حالة فشل API

## 🚀 التطوير المستقبلي

يمكنك إضافة ميزات إضافية:
- إضافة WebSocket للتحديث الفوري
- إضافة إشعارات عند تغيير كبير في الأسعار
- إضافة رسوم بيانية للبيانات التاريخية
- إضافة تصدير البيانات إلى Excel/PDF

## 📞 الدعم

إذا واجهت أي مشاكل في ربط الـ API، راجع:
1. Console في المتصفح للأخطاء
2. تأكد من أن الـ endpoints تعمل بشكل صحيح
3. تحقق من صحة تنسيق JSON المُرجع
4. تأكد من أن CORS مُعدل بشكل صحيح إذا كان الـ API على نطاق مختلف

---

**آخر تحديث:** 2026-08-17  
**الإصدار:** 1.0.0

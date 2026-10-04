# دليل الاختبار (Testing Guide)

## نظرة عامة

يقدم هذا المستند إرشادات شاملة لاختبار منصة خريطة خدمات فلسطين. يغطي الاختبار الوحدوي، اختبار التكامل، اختبار النهاية إلى النهاية، وأفضل ممارسات الاختبار.

## استراتيجية الاختبار

### هرم الاختبار

```
        اختبارات E2E (10%)
       /             \
      /               \
     /                 \
    /                   \
   اختبارات التكامل (30%)
  /                       \
 /                         \
/                           \
اختبارات الوحدة (60%)
```

### فئات الاختبار

#### اختبارات الوحدة
- اختبار الدوال والمكونات الفردية
- تنفيذ سريع
- لا تبعيات خارجية
- تغطية عالية

#### اختبارات التكامل
- اختبار تفاعلات المكونات
- تفاعلات قاعدة البيانات
- نقاط نهاية واجهة برمجة التطبيقات
- وقت تنفيذ معتدل

#### اختبارات النهاية إلى النهاية
- اختبار تدفقات المستخدم الكاملة
- أتمتة المتصفح
- تكامل النظام الكامل
- تنفيذ أبطأ

## الاختبار الوحدوي

### اختبارات الوحدة الخلفية

#### الإعداد

```bash
npm install --save-dev jest supertest
```

#### تكوين الاختبار

```javascript
// jest.config.js
module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'server.js',
        'js/**/*.js',
        '!node_modules/'
    ],
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ]
};
```

#### أمثلة الاختبارات

```javascript
// __tests__/auth.test.js
const request = require('supertest');
const app = require('../server');

describe('المصادقة', () => {
    describe('POST /api/auth/register', () => {
        it('يجب تسجيل مستخدم جديد', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'مستخدم اختبار',
                    email: 'test@example.com',
                    phone: '0591234567',
                    password: 'TestPassword123',
                    role: 'user'
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.user).toHaveProperty('user_id');
        });
        
        it('يجب رفض البريد الإلكتروني المكرر', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'مستخدم اختبار',
                    email: 'test@example.com',
                    phone: '0591234567',
                    password: 'TestPassword123',
                    role: 'user'
                })
                .expect(409);
            
            expect(response.body.success).toBe(false);
        });
    });
});
```

### اختبارات الوحدة الأمامية

#### اختبارات مكونات React

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

```javascript
// __tests__/MapComponent.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import MapComponent from '../components/MapComponent';

describe('MapComponent', () => {
    it('يعرض حاوية الخريطة', () => {
        render(<MapComponent />);
        const mapElement = screen.getByTestId('map-container');
        expect(mapElement).toBeInTheDocument();
    });
});
```

## اختبار التكامل

### اختبارات تكامل واجهة برمجة التطبيقات

```javascript
// __tests__/integration/api.test.js
const request = require('supertest');
const app = require('../server');

describe('اختبارات تكامل واجهة برمجة التطبيقات', () => {
    let authToken;
    let userId;
    
    beforeAll(async () => {
        // الإعداد: التسجيل وتسجيل الدخول
        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'مستخدم اختبار التكامل',
                email: 'integration@example.com',
                phone: '0599876543',
                password: 'TestPassword123',
                role: 'user'
            });
        
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'integration@example.com',
                password: 'TestPassword123'
            });
        
        authToken = loginResponse.body.token;
        userId = loginResponse.body.user.user_id;
    });
    
    describe('تدفق طلب الخدمة', () => {
        it('يجب إنشاء طلب خدمة', async () => {
            const response = await request(app)
                .post('/api/service-requests')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    user_id: userId,
                    service_layer: 'carpenter',
                    feature_id: 14,
                    provider_name: 'مزود اختبار',
                    service_type: 'نجار'
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('requestId');
        });
    });
});
```

### اختبارات تكامل قاعدة البيانات

```javascript
// __tests__/integration/database.test.js
const { Pool } = require('pg');

describe('اختبارات تكامل قاعدة البيانات', () => {
    let pool;
    
    beforeAll(async () => {
        pool = new Pool({
            host: process.env.POSTGRES_HOST,
            port: process.env.POSTGRES_PORT,
            database: process.env.SERVICES_DB_NAME,
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD
        });
    });
    
    afterAll(async () => {
        await pool.end();
    });
    
    it('يجب إدراج واسترجاع المستخدم', async () => {
        const insertResult = await pool.query(
            `INSERT INTO users (full_name, email, phone, password, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING user_id`,
            ['مستخدم اختبار', 'test@example.com', '0591234567', 'hashed_password', 'user']
        );
        
        const userId = insertResult.rows[0].user_id;
        
        const selectResult = await pool.query(
            'SELECT * FROM users WHERE user_id = $1',
            [userId]
        );
        
        expect(selectResult.rows[0].full_name).toBe('مستخدم اختبار');
        
        // التنظيف
        await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
    });
});
```

## اختبار النهاية إلى النهاية

### إعداد Playwright

```bash
npm install --save-dev @playwright/test
```

### مثال اختبار E2E

```javascript
// e2e/service-request.spec.js
const { test, expect } = require('@playwright/test');

test.describe('تدفق طلب الخدمة', () => {
    test('دورة حياة طلب الخدمة الكاملة', async ({ page }) => {
        // الانتقال إلى التطبيق
        await page.goto('http://localhost:5173');
        
        // تسجيل الدخول
        await page.click('[data-testid="login-button"]');
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'TestPassword123');
        await page.click('[data-testid="submit-login"]');
        
        // انتظار تحميل الخريطة
        await page.waitForSelector('[data-testid="map-container"]');
        
        // النقر على المزود
        await page.click('[data-testid="provider-marker"]');
        
        // طلب الخدمة
        await page.click('[data-testid="request-service-button"]');
        
        // التحقق من إنشاء الطلب
        await expect(page.locator('[data-testid="request-success"]')).toBeVisible();
    });
});
```

### تشغيل اختبارات E2E

```bash
npx playwright test
npx playwright test --headed
npx playwright test --project=chromium
```

## تغطية الاختبار

### تكوين التغطية

```javascript
// jest.config.js
module.exports = {
    collectCoverage: true,
    collectCoverageFrom: [
        'server.js',
        'js/**/*.js',
        '!node_modules/',
        '!**/node_modules/**'
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    }
};
```

### تشغيل التغطية

```bash
npm test -- --coverage
```

## أفضل ممارسات الاختبار

### عام

1. **اكتب الاختبارات أولاً**: التطوير القائم على الاختبار
2. **حافظ على استقلالية الاختبارات**: يجب أن يعمل كل اختبار بشكل مستقل
3. **استخدم أسماء وصفية**: يجب أن تصف أسماء الاختبارات ما تختبره
4. **اختبر الحالات الحدية**: اختبر شروط الحدود وحالات الأخطاء
5. **قم بتمثيل التبعيات الخارجية**: عزل الاختبارات عن الخدمات الخارجية

### الواجهة الخلفية

1. **اختبر جميع نقاط النهاية**: تأكد من اختبار جميع نقاط نهاية واجهة برمجة التطبيقات
2. **اختبر المصادقة**: تحقق من عمل برمجية المصادقة الوسيطة بشكل صحيح
3. **اختبر عمليات قاعدة البيانات**: اختبر عمليات CRUD
4. **اختبر معالجة الأخطاء**: تحقق من استجابات الأخطاء
5. **استخدم قاعدة بيانات اختبار**: استخدم قاعدة بيانات منفصلة للاختبار

### الواجهة الأمامية

1. **اختبر تفاعلات المستخدم**: اختبر تدفقات المستخدم والتفاعلات
2. **اختبر عرض المكونات**: تحقق من عرض المكونات بشكل صحيح
3. **اختبر إدارة الحالة**: تحقق من تغييرات الحالة
4. **اختبر معالجة الأخطاء**: تحقق من عرض رسائل الأخطاء
5. **اختبر التصميم المتجاوب**: اختبر على أحجام شاشة مختلفة

## التكامل المستمر

### مثال GitHub Actions

```yaml
# .github/workflows/test.yml
name: الاختبارات

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: إعداد Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '20'
    
    - name: تثبيت التبعيات
      run: npm install
    
    - name: تشغيل اختبارات الوحدة
      run: npm test
    
    - name: تشغيل اختبارات التكامل
      run: npm run test:integration
    
    - name: تشغيل اختبارات E2E
      run: npm run test:e2e
    
    - name: رفع التغطية
      uses: codecov/codecov-action@v2
```

---

**آخر تحديث**: 29 يوليو 2026  
**الإصدار**: 1.0.0  
**الصيانة بواسطة**: فريق التطوير

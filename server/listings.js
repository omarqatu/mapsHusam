// Validation of a business listing ("add my business"), shared by registration and the listing submissions.
import { normalizeWhatsappNumber } from './database.js';
import { PLATFORM_SERVICE_LAYERS } from './layers.js';
import { isSubmissionLayerAllowed, submissionWorkHours } from '../lib/listing-rules.js';
import { parseLandPolygon } from '../lib/listing-submission-geometry.js';

// =========================================================================
// 🆕 [أضف نشاطي]: صاحب النشاط يقدّم طلب إضافة نشاط للخريطة، والمشرف يراجعه.
// عند الموافقة: يُنشأ المعلم بجدول service_all ويُربط حساب صاحبه كمزوّد خدمة (كما يفعل المشرف يدوياً).
// الخدمات والشقق تستخدم نقطة على الخريطة؛ طلب الأرض يتضمن مضلعاً يرسمه مقدم الطلب.
// =========================================================================
export const SUBMISSION_MAX_LEN = { name: 100, des: 1000, work_hours: 200, reject_reason: 300, search_tags: 1000 };
// طبقات لا يقدّمها أصحاب الأنشطة: مواقع عامة (حواجز/وقود/معالم) وعقارات
const SUBMISSION_BLOCKED_LAYERS = new Set(['road_barriers', 'fuel_stations', 'city_landmarks', 'job_vacancies', 'free_distribution']);
export const SUBMITTABLE_PROPERTY_LAYERS = ['ApartRent', 'ApartSale', 'LandSale'];
export const SUBMITTABLE_FLAT_LAYERS = ['ApartRent', 'ApartSale'];
export const SUBMITTABLE_LAYERS = [
    ...PLATFORM_SERVICE_LAYERS.filter(layer => !SUBMISSION_BLOCKED_LAYERS.has(layer)),
    ...SUBMITTABLE_PROPERTY_LAYERS,
];
const CURRENCIES = ['ILS', 'USD', 'JOD'];
// حدود شبكة فلسطين (EPSG:28191) الواسعة: تمنع نقطة خارج البلد أو إحداثيات بنظام آخر
const GRID_X_RANGE = [100000, 300000];
const GRID_Y_RANGE = [30000, 300000];
/** A point inside the Palestine Grid area (metres), or null. */
export function gridPoint(xRaw, yRaw) {
    const x = Number(xRaw);
    const y = Number(yRaw);
    if (xRaw === undefined || yRaw === undefined || xRaw === null || yRaw === null || xRaw === '' || yRaw === '') return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < GRID_X_RANGE[0] || x > GRID_X_RANGE[1] || y < GRID_Y_RANGE[0] || y > GRID_Y_RANGE[1]) return null;
    return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
}
export const cleanText = (value, max) => (typeof value === 'string' ? value.replace(/[<>]/g, '').trim().slice(0, max) : '');
// يفحص بيانات نشاط مُرسلة (من نموذج "أضف نشاطي" أو من التسجيل) ويُرجع { value } أو { error }
export function parseListingInput(body, hidden = new Set()) {
    body = body || {};
    const layer = String(body.layer || '').trim();
    const name = cleanText(body.name, SUBMISSION_MAX_LEN.name);
    const des = cleanText(body.des, SUBMISSION_MAX_LEN.des);
    const workHours = cleanText(body.work_hours, SUBMISSION_MAX_LEN.work_hours);
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const whatsapp = body.whatsapp ? normalizeWhatsappNumber(body.whatsapp) : null;
    let x = Number(body.x_coord);
    let y = Number(body.y_coord);
    const price = body.price === undefined || body.price === null || body.price === '' ? null : Number(body.price);
    const isProperty = SUBMITTABLE_PROPERTY_LAYERS.includes(layer);
    const isLand = layer === 'LandSale';
    const geometry = isLand ? parseLandPolygon(body.geometry) : null;
    const area = !isProperty || body.area === undefined || body.area === null || body.area === '' ? null : Number(body.area);
    const currency = isProperty ? (CURRENCIES.includes(body.currency) ? body.currency : 'USD') : null;

    if (!isSubmissionLayerAllowed(layer, SUBMITTABLE_LAYERS, hidden)) return { error: 'نوع النشاط غير مسموح به.' };
    if (isLand && !geometry) return { error: 'حدود قطعة الأرض غير صالحة.' };
    if (!name) return { error: 'اسم النشاط مطلوب.' };
    if (!/^05\d{8}$/.test(phone)) return { error: 'رقم جوال النشاط غير صالح.' };
    if (body.whatsapp && !whatsapp) return { error: 'رقم واتساب النشاط غير صالح.' };
    if (isLand && (!Number.isFinite(x) || !Number.isFinite(y))) {
        const ring = geometry.coordinates[0];
        const bounds = ring.reduce(
            (b, [px, py]) => ({ minX: Math.min(b.minX, px), minY: Math.min(b.minY, py), maxX: Math.max(b.maxX, px), maxY: Math.max(b.maxY, py) }),
            { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
        );
        x = (bounds.minX + bounds.maxX) / 2;
        y = (bounds.minY + bounds.maxY) / 2;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) ||
        x < GRID_X_RANGE[0] || x > GRID_X_RANGE[1] || y < GRID_Y_RANGE[0] || y > GRID_Y_RANGE[1]) {
        return { error: 'الموقع على الخريطة غير صالح.' };
    }
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1e9)) return { error: 'السعر غير صالح.' };
    if (area !== null && (!Number.isInteger(area) || area <= 0 || area > 1e7)) return { error: 'المساحة غير صالحة.' };
    return {
        value: {
            layer, name, des: des || null, phone, whatsapp, workHours: submissionWorkHours(layer, workHours),
            geometry,
            price: isProperty && price !== null ? Math.round(price) : price, area, currency, x, y,
        },
    };
}
export const INSERT_SUBMISSION_SQL = `INSERT INTO public.listing_submissions (user_id, layer, name, des, phone, whatsapp, work_hours, price, x_coord, y_coord, area, currency, geometry)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, status, created_at`;
export const submissionParams = (userId, v) => [userId, v.layer, v.name, v.des, v.phone, v.whatsapp, v.workHours, v.price, v.x, v.y, v.area, v.currency, v.geometry];

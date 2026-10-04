// A provider editing their own listing: what may change, and the listing's pictures. Pure functions (no database,
// no express) so they can be unit-tested with `node --test`.
import { LISTING_STATUS, PROPERTY_TABLES } from './listing-rules.js';

export const EDIT_MAX_LEN = { name: 100, des: 1000, work_hours: 200 };
export const CURRENCIES = ['ILS', 'USD', 'JOD'];
/** Pictures per listing (uploaded ones and links the admin entered count alike). */
export const MAX_PHOTOS = 8;
/** Bytes per uploaded picture. The browser shrinks pictures before upload, so a real one is far smaller. */
export const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;

// The wide Palestine grid (EPSG:28191): refuses a point outside the country or in another system.
const GRID_X = [100000, 300000];
const GRID_Y = [30000, 300000];

const clean = (v, max) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '');

/** `05XXXXXXXX` → itself; anything else → null. */
const localMobile = (v) => (typeof v === 'string' && /^05\d{8}$/.test(v.trim()) ? v.trim() : null);

/** WhatsApp as stored elsewhere (`+970…`): from a local mobile or an international number. */
export function whatsappNumber(v) {
    if (typeof v !== 'string' || !v.trim()) return null;
    let d = v.replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (/^05\d{8}$/.test(d)) d = `970${d.slice(1)}`;
    return /^\d{11,15}$/.test(d) ? `+${d}` : null;
}

/**
 * Body of `PATCH /api/my-listings/:layer/:id` → `{ value }` (only the fields present, ready for SQL) or `{ error }`.
 * A property has no work hours and no point to move (the admin draws it).
 */
export function parseListingEdit(body, layer) {
    body = body && typeof body === 'object' ? body : {};
    const isProperty = PROPERTY_TABLES.includes(layer);
    const v = {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    if (has('name')) {
        v.name = clean(body.name, EDIT_MAX_LEN.name);
        if (!v.name) return { error: 'الاسم مطلوب.' };
    }
    if (has('des')) v.des = clean(body.des, EDIT_MAX_LEN.des) || null;
    if (has('phone')) {
        v.phone = localMobile(body.phone);
        if (!v.phone) return { error: 'رقم الجوال غير صالح (05XXXXXXXX).' };
    }
    if (has('whatsapp')) {
        const raw = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : '';
        v.whatsapp = raw ? whatsappNumber(raw) : null;
        if (raw && !v.whatsapp) return { error: 'رقم الواتساب غير صالح.' };
    }
    if (has('work_hours')) {
        if (isProperty) return { error: 'العقار ليس له ساعات عمل.' };
        v.work_hours = clean(body.work_hours, EDIT_MAX_LEN.work_hours) || null;
    }
    if (has('price')) {
        const p = body.price === '' || body.price === null ? null : Number(body.price);
        if (p !== null && (!Number.isFinite(p) || p < 0 || p > 1e9)) return { error: 'السعر غير صالح.' };
        v.price = p === null ? null : isProperty ? Math.round(p) : p;
    }
    if (has('currency')) {
        if (!CURRENCIES.includes(body.currency)) return { error: 'العملة غير صالحة.' };
        v.currency = body.currency;
    }
    if (has('area')) {
        const a = body.area === '' || body.area === null ? null : Number(body.area);
        if (a !== null && (!Number.isInteger(a) || a <= 0 || a > 1e7)) return { error: 'المساحة غير صالحة.' };
        v.area = a;
    }
    if (has('status')) {
        const s = Number(body.status);
        if (!Object.values(LISTING_STATUS).includes(s)) return { error: 'الحالة غير صالحة.' };
        v.status = s;
    }
    if (has('x_coord') || has('y_coord')) {
        if (isProperty) return { error: 'موقع العقار يعدّله المشرف.' };
        const x = Number(body.x_coord);
        const y = Number(body.y_coord);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < GRID_X[0] || x > GRID_X[1] || y < GRID_Y[0] || y > GRID_Y[1]) {
            return { error: 'الموقع على الخريطة غير صالح.' };
        }
        v.x_coord = x;
        v.y_coord = y;
    }
    if (Object.keys(v).length === 0) return { error: 'لا يوجد ما يُحفظ.' };
    return { value: v };
}

/** The picture type from its first bytes (never from the client's header): `jpg` / `png` / `webp` or null. */
export function photoType(buf) {
    if (!buf || buf.length < 12) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
    return null;
}

export const PHOTO_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Where an uploaded picture is served (the extension lets the map recognise it as a picture). */
export const photoUrl = (id, type) => `/api/listing-photos/${id}.${type}`;

/** `/api/listing-photos/<id>.<ext>` → `<id>`, anything else → null. */
export function photoIdFromUrl(url) {
    const m = /^\/api\/listing-photos\/([a-f0-9-]{36})\.(jpg|png|webp)$/.exec(String(url || '').trim());
    return m ? m[1] : null;
}

/** The `pic` column (a comma / newline / | / ; separated list) → its entries. */
export function picList(raw) {
    if (typeof raw !== 'string') return [];
    return raw.split(/[\r\n|,;]+/).map((s) => s.trim()).filter((s) => s && s !== '#');
}

export const joinPic = (list) => (list.length ? list.join(',') : null);

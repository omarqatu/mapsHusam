// "My listings": an account's own services and properties — read them, edit them (published at once), set their
// state (available / unavailable for now / withdrawn) and manage their pictures. New listings still go through
// listing submissions (the admin approves them).
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { IS_PROD, ROOT_DIR, app } from '../app.js';
import { realestatePool, servicesPool } from '../database.js';
import { requireAuth } from '../auth.js';
import { platformStatsCache } from '../state.js';
import { isPropertyLayer, normalizeListingLayer, ownedListings, ownsListing } from '../listing-owners.js';
import {
    BEFORE_AFTER_COLUMNS, MAX_PHOTOS, MAX_PHOTO_BYTES, PHOTO_MIME, joinPic, parseListingEdit, photoIdFromUrl, photoType,
    photoUrl, picList,
} from '../../lib/listing-edit.js';

// The picture files live on disk (UPLOADS_DIR, default `<project>/uploads`, outside git); the database keeps one row
// per picture: which listing and which account it belongs to.
const PHOTO_DIR = path.join(process.env.UPLOADS_DIR || path.join(ROOT_DIR, 'uploads'), 'listing-photos');
const photoFile = (id, type) => path.join(PHOTO_DIR, `${id}.${type}`);

async function ensurePhotosSchema() {
    try {
        await fs.mkdir(PHOTO_DIR, { recursive: true });
        await servicesPool.query(`
            CREATE TABLE IF NOT EXISTS public.listing_photos (
                id UUID PRIMARY KEY,
                layer TEXT NOT NULL,
                feature_id BIGINT NOT NULL,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        await servicesPool.query('CREATE INDEX IF NOT EXISTS listing_photos_listing_idx ON public.listing_photos (layer, feature_id)');
    } catch (err) {
        console.error('⚠️ خطأ أثناء تجهيز تخزين صور الإعلانات:', err.message);
    }
}
ensurePhotosSchema();

const SERVICE_COLUMNS = `id, discriminator AS layer, name, des, phone, whatsapp, work_hours, price, currency, area,
    location_name AS location, status, auto_status, end_date, pic, x_coord, y_coord,
    details_link_1, details_link_2, media_default`;
const PROPERTY_COLUMNS = (table) => `fid AS id, '${table}' AS layer, name, des, phone, whatsapp, NULL AS work_hours, price,
    currency, area, location, status, auto_status, end_date, pic,
    ST_X(ST_PointOnSurface(geom)) AS x_coord, ST_Y(ST_PointOnSurface(geom)) AS y_coord,
    NULL AS details_link_1, NULL AS details_link_2, NULL AS media_default`;

/** One listing row as the page reads it. */
function toListing(row, ratings) {
    const key = `${row.layer}:${row.id}`;
    return {
        layer: row.layer,
        id: Number(row.id),
        kind: isPropertyLayer(row.layer) ? 'property' : 'service',
        name: row.name || '',
        des: row.des || '',
        phone: row.phone || '',
        whatsapp: row.whatsapp || '',
        work_hours: row.work_hours || '',
        price: row.price === null || row.price === undefined ? null : Number(row.price),
        currency: row.currency || null,
        area: row.area === null || row.area === undefined ? null : Number(row.area),
        location: row.location || '',
        status: Number(row.status) || 0,
        auto_status: Number(row.auto_status) || 0,
        end_date: row.end_date || null,
        photos: picList(row.pic),
        // services only: the before / after pair and what the card opens on
        before: row.details_link_1 || null,
        after: row.details_link_2 || null,
        media_default: row.media_default === 'before_after' ? 'before_after' : 'photos',
        x: row.x_coord === null ? null : Number(row.x_coord),
        y: row.y_coord === null ? null : Number(row.y_coord),
        rating_avg: ratings.get(key)?.avg ?? null,
        rating_count: ratings.get(key)?.count ?? 0,
    };
}

async function readListings(owned) {
    if (owned.length === 0) return [];
    const rows = [];
    const services = owned.filter((o) => !isPropertyLayer(o.layer));
    if (services.length) {
        const r = await servicesPool.query(`SELECT ${SERVICE_COLUMNS} FROM public.service_all WHERE id = ANY($1::int[])`, [services.map((o) => o.feature_id)]);
        const wanted = new Set(services.map((o) => `${o.layer}:${o.feature_id}`));
        rows.push(...r.rows.filter((row) => wanted.has(`${row.layer}:${row.id}`)));
    }
    for (const table of ['ApartRent', 'ApartSale', 'LandSale']) {
        const ids = owned.filter((o) => o.layer === table).map((o) => o.feature_id);
        if (!ids.length) continue;
        const r = await realestatePool.query(`SELECT ${PROPERTY_COLUMNS(table)} FROM public."${table}" WHERE fid = ANY($1::bigint[])`, [ids]);
        rows.push(...r.rows);
    }
    const ratings = new Map();
    const rated = await servicesPool.query(
        `SELECT service_layer, feature_id, ROUND(AVG(rating)::numeric, 1) AS avg, COUNT(*)::int AS count
         FROM public.service_ratings WHERE (service_layer, feature_id) IN (SELECT * FROM UNNEST($1::text[], $2::int[]))
         GROUP BY service_layer, feature_id`,
        [rows.map((r) => r.layer), rows.map((r) => Number(r.id))],
    );
    for (const r of rated.rows) ratings.set(`${r.service_layer}:${r.feature_id}`, { avg: Number(r.avg), count: r.count });
    const order = new Map(owned.map((o, i) => [`${o.layer}:${o.feature_id}`, i]));
    return rows.map((row) => toListing(row, ratings)).sort((a, b) => order.get(`${a.layer}:${a.id}`) - order.get(`${b.layer}:${b.id}`));
}

/** `:layer/:id` of a listing this account owns → `{ layer, id }`, or an answer already sent. */
async function ownedTarget(req, res) {
    const layer = normalizeListingLayer(req.params.layer);
    const id = /^\d{1,12}$/.test(req.params.id) ? Number(req.params.id) : null;
    if (!layer || !id) {
        res.status(400).json({ success: false, error: 'إعلان غير صالح.' });
        return null;
    }
    if (!(await ownsListing(req.auth.uid, layer, id))) {
        res.status(404).json({ success: false, error: 'هذا الإعلان غير مرتبط بحسابك.' });
        return null;
    }
    return { layer, id };
}

const poolFor = (layer) => (isPropertyLayer(layer) ? realestatePool : servicesPool);
const whereFor = (layer, first) =>
    isPropertyLayer(layer)
        ? { table: `public."${layer}"`, where: `fid = $${first}`, params: (id) => [id] }
        : { table: 'public.service_all', where: `id = $${first} AND discriminator = $${first + 1}`, params: (id) => [id, layer] };

async function readOne(layer, id) {
    return (await readListings([{ layer, feature_id: id }]))[0] || null;
}

app.get('/api/my-listings', requireAuth, async (req, res) => {
    try {
        res.json({ success: true, listings: await readListings(await ownedListings(req.auth.uid)) });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب إعلاناتي:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب الإعلانات.', details: IS_PROD ? undefined : err.message });
    }
});

const editLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'تعديلات كثيرة خلال وقت قصير، حاول بعد قليل.' },
});

app.patch('/api/my-listings/:layer/:id', requireAuth, editLimiter, async (req, res) => {
    try {
        const target = await ownedTarget(req, res);
        if (!target) return;
        const parsed = parseListingEdit(req.body, target.layer);
        if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });

        const sets = [];
        const values = [];
        const at = {};
        for (const [col, val] of Object.entries(parsed.value)) {
            values.push(val);
            at[col] = values.length;
            sets.push(`${col} = $${values.length}`);
        }
        // a moved service: the point itself, not only the two number columns
        if (at.x_coord) sets.push(`geom = ST_SetSRID(ST_MakePoint($${at.x_coord}::float8, $${at.y_coord}::float8), 28191)`);
        if (!isPropertyLayer(target.layer)) sets.push('updated_at = NOW()');
        const w = whereFor(target.layer, values.length + 1);
        const result = await poolFor(target.layer).query(
            `UPDATE ${w.table} SET ${sets.join(', ')} WHERE ${w.where}`,
            [...values, ...w.params(target.id)],
        );
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'الإعلان غير موجود.' });
        platformStatsCache.clear();
        res.json({ success: true, listing: await readOne(target.layer, target.id) });
    } catch (err) {
        console.error('❌ خطأ أثناء تعديل إعلان:', err.message);
        res.status(500).json({ success: false, error: 'فشل حفظ التعديل.', details: IS_PROD ? undefined : err.message });
    }
});

async function readPic(layer, id) {
    const w = whereFor(layer, 1);
    const r = await poolFor(layer).query(`SELECT pic FROM ${w.table} WHERE ${w.where}`, w.params(id));
    return r.rows[0] ? picList(r.rows[0].pic) : null;
}

async function writePic(layer, id, list) {
    const w = whereFor(layer, 2);
    await poolFor(layer).query(`UPDATE ${w.table} SET pic = $1 WHERE ${w.where}`, [joinPic(list), ...w.params(id)]);
}

/** Saves an uploaded picture of this listing (file + its `listing_photos` row) → its url, or null if not an image. */
async function storeUpload(target, uid, body) {
    const type = Buffer.isBuffer(body) ? photoType(body) : null;
    if (!type) return null;
    const id = crypto.randomUUID();
    await fs.writeFile(photoFile(id, type), body, { flag: 'wx' });
    await servicesPool.query(
        'INSERT INTO public.listing_photos (id, layer, feature_id, user_id, type) VALUES ($1, $2, $3, $4, $5)',
        [id, target.layer, target.id, uid, type],
    );
    return photoUrl(id, type);
}

/** Deletes the files of these urls that were uploaded to this listing; links the admin entered are left alone. */
async function deleteUploads(target, urls) {
    const ids = urls.map(photoIdFromUrl).filter(Boolean);
    if (!ids.length) return;
    const gone = await servicesPool.query(
        'DELETE FROM public.listing_photos WHERE id = ANY($1::uuid[]) AND layer = $2 AND feature_id = $3 RETURNING id, type',
        [ids, target.layer, target.id],
    );
    await Promise.all(gone.rows.map((r) => fs.rm(photoFile(r.id, r.type), { force: true })));
}

const NOT_AN_IMAGE = 'الصورة يجب أن تكون JPG أو PNG أو WebP.';

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'صور كثيرة خلال وقت قصير، حاول بعد قليل.' },
});

// The picture is the raw request body (image/jpeg, image/png or image/webp); its real type is read from its bytes.
app.post(
    '/api/my-listings/:layer/:id/photos',
    requireAuth,
    uploadLimiter,
    express.raw({ type: () => true, limit: MAX_PHOTO_BYTES }),
    async (req, res) => {
        try {
            const target = await ownedTarget(req, res);
            if (!target) return;
            if (!(Buffer.isBuffer(req.body) && photoType(req.body))) {
                return res.status(415).json({ success: false, error: NOT_AN_IMAGE });
            }
            const list = await readPic(target.layer, target.id);
            if (list === null) return res.status(404).json({ success: false, error: 'الإعلان غير موجود.' });
            if (list.length >= MAX_PHOTOS) {
                return res.status(409).json({ success: false, error: `الحد ${MAX_PHOTOS} صور لكل إعلان.` });
            }
            const url = await storeUpload(target, req.auth.uid, req.body);
            await writePic(target.layer, target.id, [...list, url]);
            res.json({ success: true, url, photos: [...list, url] });
        } catch (err) {
            console.error('❌ خطأ أثناء رفع صورة:', err.message);
            res.status(500).json({ success: false, error: 'فشل رفع الصورة.', details: IS_PROD ? undefined : err.message });
        }
    },
);

// Body `{ photos: [...] }`: the new order, without the removed ones. Only pictures the listing already has are kept;
// an uploaded one that is left out is deleted.
app.put('/api/my-listings/:layer/:id/photos', requireAuth, editLimiter, async (req, res) => {
    try {
        const target = await ownedTarget(req, res);
        if (!target) return;
        const wanted = Array.isArray(req.body?.photos) ? req.body.photos.filter((p) => typeof p === 'string') : null;
        if (!wanted) return res.status(400).json({ success: false, error: 'قائمة الصور مطلوبة.' });
        const list = await readPic(target.layer, target.id);
        if (list === null) return res.status(404).json({ success: false, error: 'الإعلان غير موجود.' });
        const next = [...new Set(wanted)].filter((p) => list.includes(p));
        await writePic(target.layer, target.id, next);
        await deleteUploads(target, list.filter((p) => !next.includes(p)));
        res.json({ success: true, photos: next });
    } catch (err) {
        console.error('❌ خطأ أثناء ترتيب الصور:', err.message);
        res.status(500).json({ success: false, error: 'فشل حفظ الصور.', details: IS_PROD ? undefined : err.message });
    }
});

// --- before / after (services only): one picture per side, in details_link_1 / details_link_2 ---------------------

/** `:side` of a service this account owns → `{ target, column }`, or an answer already sent. */
async function beforeAfterTarget(req, res) {
    const column = BEFORE_AFTER_COLUMNS[req.params.side];
    if (!column) {
        res.status(404).json({ success: false, error: 'غير موجود.' });
        return null;
    }
    const target = await ownedTarget(req, res);
    if (!target) return null;
    if (isPropertyLayer(target.layer)) {
        res.status(400).json({ success: false, error: 'صور قبل وبعد للخدمات فقط.' });
        return null;
    }
    return { target, column };
}

/** Puts `url` (or NULL) in the side's column → the previous value, or undefined when the listing is gone. */
async function swapSide(target, column, url) {
    const w = whereFor(target.layer, 1);
    const client = await servicesPool.connect();
    try {
        await client.query('BEGIN');
        const prev = await client.query(`SELECT ${column} AS old FROM ${w.table} WHERE ${w.where} FOR UPDATE`, w.params(target.id));
        if (!prev.rowCount) {
            await client.query('ROLLBACK');
            return undefined;
        }
        const set = whereFor(target.layer, 2);
        await client.query(
            `UPDATE ${set.table} SET ${column} = $1, updated_at = NOW() WHERE ${set.where}`,
            [url, ...set.params(target.id)],
        );
        await client.query('COMMIT');
        return prev.rows[0].old;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

// The picture is the raw request body, as for the listing's pictures. It replaces the side's previous picture.
app.post(
    '/api/my-listings/:layer/:id/before-after/:side',
    requireAuth,
    uploadLimiter,
    express.raw({ type: () => true, limit: MAX_PHOTO_BYTES }),
    async (req, res) => {
        try {
            const found = await beforeAfterTarget(req, res);
            if (!found) return;
            const url = await storeUpload(found.target, req.auth.uid, req.body);
            if (!url) return res.status(415).json({ success: false, error: NOT_AN_IMAGE });
            const old = await swapSide(found.target, found.column, url);
            if (old === undefined) {
                await deleteUploads(found.target, [url]);
                return res.status(404).json({ success: false, error: 'الإعلان غير موجود.' });
            }
            if (old && old !== url) await deleteUploads(found.target, [old]);
            res.json({ success: true, listing: await readOne(found.target.layer, found.target.id) });
        } catch (err) {
            console.error('❌ خطأ أثناء رفع صورة قبل/بعد:', err.message);
            res.status(500).json({ success: false, error: 'فشل رفع الصورة.', details: IS_PROD ? undefined : err.message });
        }
    },
);

app.delete('/api/my-listings/:layer/:id/before-after/:side', requireAuth, editLimiter, async (req, res) => {
    try {
        const found = await beforeAfterTarget(req, res);
        if (!found) return;
        const old = await swapSide(found.target, found.column, null);
        if (old === undefined) return res.status(404).json({ success: false, error: 'الإعلان غير موجود.' });
        if (old) await deleteUploads(found.target, [old]);
        res.json({ success: true, listing: await readOne(found.target.layer, found.target.id) });
    } catch (err) {
        console.error('❌ خطأ أثناء حذف صورة قبل/بعد:', err.message);
        res.status(500).json({ success: false, error: 'فشل حذف الصورة.', details: IS_PROD ? undefined : err.message });
    }
});

// Public: the picture itself. The id is random, the bytes never change (a new picture gets a new id). The file name
// is rebuilt from the checked id and type, so a request can never reach another path.
app.get('/api/listing-photos/:file', async (req, res) => {
    const m = /^([a-f0-9-]{36})\.(jpg|png|webp)$/.exec(req.params.file);
    if (!m || !photoIdFromUrl(`/api/listing-photos/${req.params.file}`)) return res.status(404).end();
    const [, id, type] = m;
    res.sendFile(photoFile(id, type), {
        headers: {
            'Content-Type': PHOTO_MIME[type],
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Security-Policy': "default-src 'none'; sandbox",
            'X-Content-Type-Options': 'nosniff',
        },
        cacheControl: false,
        lastModified: false,
    }, (err) => {
        if (err && !res.headersSent) res.status(err.statusCode === 404 || err.code === 'ENOENT' ? 404 : 500).end();
    });
});

// Who worked on a property: "surveyed by", "valued by". A relation between a property and a provider's listing that BOTH
// sides agree to — the rules (sides, states, what a relation may join) are in lib/property-relations.js. Only accepted
// relations are public; they give no right to rate and are not a verification.
import rateLimit from 'express-rate-limit';
import { IS_PROD, app } from '../app.js';
import { realestatePool, servicesPool } from '../database.js';
import { requireAuth } from '../auth.js';
import { isPropertyLayer, normalizeListingLayer, ownedListings } from '../listing-owners.js';
import { notifyUser } from '../state.js';
import { getHiddenLayers } from '../visibility.js';
import { isLayerHidden } from '../../lib/listing-rules.js';
import {
    RELATIONS, canAnswer, canRevoke, relationError, sidesOf, startingConsent, statusOf, waitingFor,
} from '../../lib/property-relations.js';

const digits = (v) => (/^\d{1,12}$/.test(String(v ?? '')) ? Number(v) : null);
const isAdmin = (req) => req.auth.role === 'admin';

const writeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'طلبات كثيرة خلال وقت قصير، حاول بعد قليل.' },
});

const RELATION_AR = { surveyed_by: 'مسح', valued_by: 'تخمين' };

// --- reading properties and providers ---------------------------------------------------------------------------------

/** `{ id, name, status }` of a property (a plot / flat), or null. */
async function loadProperty(layer, id) {
    const r = await realestatePool.query(
        `SELECT fid AS id, COALESCE(NULLIF(name, ''), NULLIF(location, '')) AS name, status FROM public."${layer}" WHERE fid = $1`,
        [id],
    );
    return r.rows[0] ? { id: Number(r.rows[0].id), name: r.rows[0].name || '', status: Number(r.rows[0].status) || 0 } : null;
}

/** `{ id, name, status }` of a provider's listing of this service type, or null. */
async function loadProvider(layer, id) {
    const r = await servicesPool.query(
        'SELECT id, name, status FROM public.service_all WHERE id = $1 AND discriminator = $2',
        [id, layer],
    );
    return r.rows[0] ? { id: Number(r.rows[0].id), name: r.rows[0].name || '', status: Number(r.rows[0].status) || 0 } : null;
}

const WITHDRAWN = 2;

/** Account ids that own a listing. */
async function ownersOf(layer, id) {
    const r = await servicesPool.query('SELECT user_id FROM public.listing_owners WHERE layer = $1 AND feature_id = $2', [layer, id]);
    return r.rows.map((x) => Number(x.user_id));
}

async function adminIds() {
    const r = await servicesPool.query(`SELECT user_id FROM public.users WHERE role = 'admin' AND is_active = true`);
    return r.rows.map((x) => Number(x.user_id));
}

/** This account's side(s) on one relation row. */
async function sidesFor(req, row) {
    const [propertyOwners, providerOwners] = await Promise.all([
        ownersOf(row.property_layer, row.property_id),
        ownersOf(row.provider_layer, row.provider_id),
    ]);
    const uid = req.auth.uid;
    return {
        sides: sidesOf({
            ownsProperty: propertyOwners.includes(uid),
            propertyHasOwner: propertyOwners.length > 0,
            ownsProvider: providerOwners.includes(uid),
            isAdmin: isAdmin(req),
        }),
        propertyOwners,
        providerOwners,
    };
}

/** Tells the account(s) a relation now waits for (the property's owners, else the admins; or the provider's owners). */
async function notifyWaiting(row, propertyName, providerName, propertyOwners, providerOwners) {
    const side = waitingFor(row);
    if (!side) return;
    const what = `${RELATION_AR[row.relation] || 'ربط'}`;
    if (side === 'provider') {
        await Promise.all(providerOwners.map((u) => notifyUser(
            u, '🤝 طلب ربط بعقار', `طُلب ربط «${providerName}» بعقار «${propertyName || row.property_id}» (${what}). افتح إعلاناتي للرد.`, 'info', '/my-listings',
        )));
    } else if (propertyOwners.length > 0) {
        await Promise.all(propertyOwners.map((u) => notifyUser(
            u, '🤝 طلب ربط بعقارك', `«${providerName}» يطلب أن يُذكر على «${propertyName || row.property_id}» (${what}). افتح إعلاناتي للرد.`, 'info', '/my-listings',
        )));
    } else {
        await Promise.all((await adminIds()).map((u) => notifyUser(
            u, '🤝 طلب ربط بعقار بلا مالك', `«${providerName}» يطلب أن يُذكر على «${propertyName || row.property_id}» (${what}).`, 'info', '/admin/relations',
        )));
    }
}

// --- public: who worked on this property ------------------------------------------------------------------------------

// Accepted relations of one property, for its card. Provider types the admin hid and withdrawn listings are left out.
app.get('/api/property-relations', async (req, res) => {
    const layer = normalizeListingLayer(req.query.property_layer);
    const id = digits(req.query.property_id);
    if (!layer || !isPropertyLayer(layer) || id === null) {
        return res.status(400).json({ success: false, error: 'عقار غير صالح.' });
    }
    try {
        const hidden = await getHiddenLayers();
        const r = await servicesPool.query(
            `SELECT r.id, r.relation, r.provider_layer, r.provider_id, s.name AS provider_name,
                    GREATEST(r.property_ok_at, r.provider_ok_at) AS accepted_at
             FROM public.property_relations r
             JOIN public.service_all s ON s.id = r.provider_id AND s.discriminator = r.provider_layer
             WHERE r.property_layer = $1 AND r.property_id = $2 AND r.status = 'accepted' AND s.status <> $3
             ORDER BY accepted_at DESC`,
            [layer, id, WITHDRAWN],
        );
        res.json({
            success: true,
            items: r.rows
                .filter((x) => !isLayerHidden(x.provider_layer, hidden))
                .map((x) => ({
                    id: Number(x.id),
                    relation: x.relation,
                    provider_layer: x.provider_layer,
                    provider_id: Number(x.provider_id),
                    provider_name: x.provider_name || '',
                    accepted_at: x.accepted_at,
                })),
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب علاقات العقار:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب البيانات', details: IS_PROD ? undefined : err.message });
    }
});

// --- asking -----------------------------------------------------------------------------------------------------------

// Body `{ property_layer, property_id, relation, provider_layer, provider_id }`. The caller's side(s) decide what happens:
// the property's owner (or an admin, for a property nobody owns) or the provider's owner starts it pending with their
// own consent; someone on both sides gets it accepted at once; anyone else is refused.
app.post('/api/property-relations', requireAuth, writeLimiter, async (req, res) => {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const bad = (error, status = 400) => res.status(status).json({ success: false, error });
    const propertyLayer = normalizeListingLayer(b.property_layer);
    const providerLayer = normalizeListingLayer(b.provider_layer);
    const propertyId = digits(b.property_id);
    const providerId = digits(b.provider_id);
    if (!propertyLayer || !isPropertyLayer(propertyLayer) || propertyId === null) return bad('عقار غير صالح.');
    if (!providerLayer || isPropertyLayer(providerLayer) || providerId === null) return bad('مزود غير صالح.');
    const invalid = relationError(b.relation, propertyLayer, providerLayer);
    if (invalid) return bad(invalid);

    try {
        const [property, provider] = await Promise.all([loadProperty(propertyLayer, propertyId), loadProvider(providerLayer, providerId)]);
        if (!property || property.status === WITHDRAWN) return bad('العقار غير موجود.', 404);
        if (!provider || provider.status === WITHDRAWN) return bad('المزود غير موجود.', 404);

        const probe = { property_layer: propertyLayer, property_id: propertyId, provider_layer: providerLayer, provider_id: providerId };
        const { sides, propertyOwners, providerOwners } = await sidesFor(req, probe);
        const consent = startingConsent(sides);
        if (!consent) return bad('لا تملك صلاحية ربط هذا العقار بهذا المزود: يطلبه صاحب العقار أو صاحب إعلان المزود.', 403);

        const status = statusOf(consent);
        const now = new Date();
        const inserted = await servicesPool.query(
            `INSERT INTO public.property_relations
                (property_layer, property_id, relation, provider_layer, provider_id, status,
                 property_ok_by, property_ok_at, provider_ok_by, provider_ok_at, requested_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                propertyLayer, propertyId, b.relation, providerLayer, providerId, status,
                consent.property ? req.auth.uid : null, consent.property ? now : null,
                consent.provider ? req.auth.uid : null, consent.provider ? now : null,
                req.auth.uid,
            ],
        );
        const row = inserted.rows[0];
        await notifyWaiting(row, property.name, provider.name, propertyOwners, providerOwners);
        res.json({ success: true, id: Number(row.id), status: row.status, waiting_for: waitingFor(row) });
    } catch (err) {
        if (err.code === '23505') return bad('هذه العلاقة قائمة بالفعل.', 409);
        console.error('❌ خطأ أثناء طلب ربط عقار:', err.message);
        res.status(500).json({ success: false, error: 'فشل إرسال الطلب.', details: IS_PROD ? undefined : err.message });
    }
});

async function loadRow(req, res) {
    const id = digits(req.params.id);
    const r = id === null ? { rows: [] } : await servicesPool.query('SELECT * FROM public.property_relations WHERE id = $1', [id]);
    if (!r.rows[0]) {
        res.status(404).json({ success: false, error: 'الطلب غير موجود.' });
        return null;
    }
    return r.rows[0];
}

// The other side answers a pending relation: `{ accept: true }` makes it accepted, `{ accept: false }` declines it.
app.post('/api/property-relations/:id/respond', requireAuth, writeLimiter, async (req, res) => {
    try {
        const row = await loadRow(req, res);
        if (!row) return;
        const { sides } = await sidesFor(req, row);
        if (!canAnswer(row, sides)) {
            return res.status(403).json({ success: false, error: 'هذا الطلب ينتظر رد الطرف الآخر، أو لا يخصك.' });
        }
        const accept = req.body?.accept === true;
        const side = waitingFor(row);
        const updated = accept
            ? await servicesPool.query(
                `UPDATE public.property_relations SET status = 'accepted', ${side}_ok_by = $2, ${side}_ok_at = NOW(), updated_at = NOW()
                 WHERE id = $1 AND status = 'pending' RETURNING *`,
                [row.id, req.auth.uid],
            )
            : await servicesPool.query(
                `UPDATE public.property_relations SET status = 'revoked', revoked_by = $2, revoked_at = NOW(), updated_at = NOW()
                 WHERE id = $1 AND status = 'pending' RETURNING *`,
                [row.id, req.auth.uid],
            );
        if (!updated.rows[0]) return res.status(409).json({ success: false, error: 'تغيّرت حالة الطلب، حدّث الصفحة.' });
        if (Number(row.requested_by) !== req.auth.uid) {
            await notifyUser(
                row.requested_by,
                accept ? '✅ تم قبول طلب الربط' : '❌ تم رفض طلب الربط',
                accept ? 'وافق الطرف الآخر على الربط وصار يظهر على بطاقة العقار.' : 'رفض الطرف الآخر طلب الربط.',
                'info',
                '/my-listings',
            );
        }
        res.json({ success: true, status: updated.rows[0].status });
    } catch (err) {
        console.error('❌ خطأ أثناء الرد على طلب ربط:', err.message);
        res.status(500).json({ success: false, error: 'فشل الرد على الطلب.', details: IS_PROD ? undefined : err.message });
    }
});

// Anyone involved takes it back (withdraws a pending request, ends an accepted one); an admin may always.
app.post('/api/property-relations/:id/revoke', requireAuth, writeLimiter, async (req, res) => {
    try {
        const row = await loadRow(req, res);
        if (!row) return;
        const { sides, propertyOwners, providerOwners } = await sidesFor(req, row);
        if (!canRevoke(row, sides, isAdmin(req))) {
            return res.status(403).json({ success: false, error: row.status === 'revoked' ? 'أُلغي هذا الربط من قبل.' : 'لا تملك صلاحية إلغاء هذا الربط.' });
        }
        const updated = await servicesPool.query(
            `UPDATE public.property_relations SET status = 'revoked', revoked_by = $2, revoked_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND status <> 'revoked' RETURNING *`,
            [row.id, req.auth.uid],
        );
        if (!updated.rows[0]) return res.status(409).json({ success: false, error: 'أُلغي هذا الربط من قبل.' });
        // tell everyone involved except the person who did it
        const involved = new Set([...propertyOwners, ...providerOwners, Number(row.requested_by)]);
        involved.delete(req.auth.uid);
        await Promise.all([...involved].map((u) => notifyUser(u, '↩️ أُلغي ربط بعقار', 'أُلغي ربط عقار بمزود خدمة كان قائماً أو معلّقاً.', 'info', '/my-listings')));
        res.json({ success: true, status: 'revoked' });
    } catch (err) {
        console.error('❌ خطأ أثناء إلغاء ربط عقار:', err.message);
        res.status(500).json({ success: false, error: 'فشل إلغاء الربط.', details: IS_PROD ? undefined : err.message });
    }
});

// --- mine -------------------------------------------------------------------------------------------------------------

// The relations this account is a side of (its properties, its provider listings, what it asked), with what it may do
// with each; an admin also gets every pending one, to answer for properties nobody owns. Newest first, at most 200.
app.get('/api/my-property-relations', requireAuth, async (req, res) => {
    try {
        const uid = req.auth.uid;
        const owned = await ownedListings(uid);
        const layers = owned.map((o) => o.layer);
        const ids = owned.map((o) => o.feature_id);
        const rows = (await servicesPool.query(
            `SELECT * FROM public.property_relations r
             WHERE r.requested_by = $1
                OR (r.property_layer, r.property_id) IN (SELECT * FROM UNNEST($2::text[], $3::bigint[]))
                OR (r.provider_layer, r.provider_id) IN (SELECT * FROM UNNEST($2::text[], $3::bigint[]))
                OR ($4 AND r.status = 'pending')
             ORDER BY r.updated_at DESC LIMIT 200`,
            [uid, layers, ids, isAdmin(req)],
        )).rows;

        // names, and whether each property has an owner
        const propertyKeys = [...new Set(rows.map((r) => `${r.property_layer}:${r.property_id}`))];
        const providerKeys = [...new Set(rows.map((r) => `${r.provider_layer}:${r.provider_id}`))];
        const propertyNames = new Map();
        for (const table of ['ApartRent', 'ApartSale', 'LandSale']) {
            const want = rows.filter((r) => r.property_layer === table).map((r) => Number(r.property_id));
            if (!want.length) continue;
            const found = await realestatePool.query(
                `SELECT fid, COALESCE(NULLIF(name, ''), NULLIF(location, '')) AS name FROM public."${table}" WHERE fid = ANY($1::bigint[])`,
                [want],
            );
            for (const f of found.rows) propertyNames.set(`${table}:${f.fid}`, f.name || '');
        }
        const providerNames = new Map();
        if (providerKeys.length) {
            const found = await servicesPool.query(
                'SELECT id, discriminator, name FROM public.service_all WHERE id = ANY($1::int[])',
                [[...new Set(rows.map((r) => Number(r.provider_id)))]],
            );
            for (const f of found.rows) providerNames.set(`${f.discriminator}:${f.id}`, f.name || '');
        }
        const owners = new Map();
        if (propertyKeys.length) {
            const found = await servicesPool.query(
                `SELECT layer, feature_id, user_id FROM public.listing_owners
                 WHERE (layer, feature_id) IN (SELECT * FROM UNNEST($1::text[], $2::bigint[]))`,
                [rows.map((r) => r.property_layer), rows.map((r) => Number(r.property_id))],
            );
            for (const f of found.rows) {
                const k = `${f.layer}:${f.feature_id}`;
                owners.set(k, [...(owners.get(k) || []), Number(f.user_id)]);
            }
        }
        const mine = new Set(owned.map((o) => `${o.layer}:${o.feature_id}`));

        res.json({
            success: true,
            items: rows.map((r) => {
                const pKey = `${r.property_layer}:${r.property_id}`;
                const vKey = `${r.provider_layer}:${r.provider_id}`;
                const propertyOwners = owners.get(pKey) || [];
                const sides = sidesOf({
                    ownsProperty: mine.has(pKey),
                    propertyHasOwner: propertyOwners.length > 0,
                    ownsProvider: mine.has(vKey),
                    isAdmin: isAdmin(req),
                });
                return {
                    id: Number(r.id),
                    relation: r.relation,
                    status: r.status,
                    property_layer: r.property_layer,
                    property_id: Number(r.property_id),
                    property_name: propertyNames.get(pKey) || '',
                    property_has_owner: propertyOwners.length > 0,
                    provider_layer: r.provider_layer,
                    provider_id: Number(r.provider_id),
                    provider_name: providerNames.get(vKey) || '',
                    waiting_for: waitingFor(r),
                    i_asked: Number(r.requested_by) === uid,
                    can_answer: canAnswer(r, sides),
                    can_revoke: canRevoke(r, sides, isAdmin(req)),
                    created_at: r.created_at,
                    updated_at: r.updated_at,
                };
            }),
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب علاقاتي:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب البيانات', details: IS_PROD ? undefined : err.message });
    }
});



// Who owns which listing: one account may own several services and properties. `layer` is the service discriminator
// or the property table (`ApartRent` / `ApartSale` / `LandSale`); `feature_id` is the row's `id` in service_all or
// `fid` in a property table.
// `users.service_layer` / `users.feature_id` stay as the account's first listing (the provider panel, the admin's
// user editor and the login answer read them); every link written there is mirrored here.
import { realestatePool, servicesPool } from './database.js';
import { PLATFORM_PROPERTY_LAYERS, isValidLayer } from './layers.js';
import { clearProviderLinkedCache, clearPublicListingCaches } from './state.js';

/** `services:plumberLayer` / `plumberLayer` / `apartrent` → `plumber` / `ApartRent`; unknown → null. */
export function normalizeListingLayer(raw) {
    const s = String(raw || '').trim().replace(/^.*:/, '').replace(/Layer$/i, '');
    if (!s) return null;
    const property = PLATFORM_PROPERTY_LAYERS.find((t) => t.toLowerCase() === s.toLowerCase());
    if (property) return property;
    if (isValidLayer(s)) return s;
    return isValidLayer(s.toLowerCase()) ? s.toLowerCase() : null;
}

export const isPropertyLayer = (layer) => PLATFORM_PROPERTY_LAYERS.includes(layer);

export const ready = (async () => {
    try {
        await servicesPool.query(`
            CREATE TABLE IF NOT EXISTS public.listing_owners (
                layer TEXT NOT NULL,
                feature_id BIGINT NOT NULL,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY (layer, feature_id)
            )
        `);
        await servicesPool.query('CREATE INDEX IF NOT EXISTS listing_owners_user_idx ON public.listing_owners (user_id)');
        // The links made before this table existed (one per account).
        const linked = await servicesPool.query(
            `SELECT user_id, service_layer, feature_id FROM public.users WHERE service_layer IS NOT NULL AND feature_id IS NOT NULL`,
        );
        for (const row of linked.rows) {
            const layer = normalizeListingLayer(row.service_layer);
            if (layer) await linkOwner(servicesPool, layer, row.feature_id, row.user_id, { keep: true });
        }
    } catch (err) {
        console.error('⚠️ خطأ أثناء تجهيز جدول ملكية الإعلانات:', err.message);
    }
})();

/**
 * Gives a listing to an account. `keep` = leave an existing owner alone (the start-up copy); otherwise the listing moves
 * to this account (the admin re-linked it). `db` = a pool or a client inside a transaction.
 */
export async function linkOwner(db, layer, featureId, userId, { keep = false } = {}) {
    await db.query(
        `INSERT INTO public.listing_owners (layer, feature_id, user_id) VALUES ($1, $2, $3)
         ON CONFLICT (layer, feature_id) DO ${keep ? 'NOTHING' : 'UPDATE SET user_id = EXCLUDED.user_id'}`,
        [layer, featureId, userId],
    );
}

export async function unlinkOwner(db, layer, featureId, userId) {
    await db.query('DELETE FROM public.listing_owners WHERE layer = $1 AND feature_id = $2 AND user_id = $3', [layer, featureId, userId]);
}

/** Remove ownership metadata after a map feature is deleted and point each affected account at a remaining listing. */
export async function reconcileDeletedListing(layer, featureId) {
    const normalized = normalizeListingLayer(layer);
    const id = Number(featureId);
    if (!normalized || !Number.isSafeInteger(id) || id <= 0) return;
    await ready;

    const client = await servicesPool.connect();
    try {
        await client.query('BEGIN');
        const owned = await client.query(
            'DELETE FROM public.listing_owners WHERE layer = $1 AND feature_id = $2 RETURNING user_id',
            [normalized, id],
        );
        const legacy = await client.query(
            'SELECT user_id, service_layer, feature_id FROM public.users WHERE feature_id = $1 AND service_layer IS NOT NULL',
            [id],
        );
        const affected = new Set(owned.rows.map((row) => Number(row.user_id)));
        for (const row of legacy.rows) {
            if (normalizeListingLayer(row.service_layer) === normalized) affected.add(Number(row.user_id));
        }

        for (const userId of affected) {
            const remaining = await client.query(
                'SELECT layer, feature_id FROM public.listing_owners WHERE user_id = $1 ORDER BY created_at, layer, feature_id LIMIT 1',
                [userId],
            );
            const next = remaining.rows[0];
            if (!next) {
                await client.query(
                    'UPDATE public.users SET service_layer = NULL, feature_id = NULL, x_coord = NULL, y_coord = NULL WHERE user_id = $1',
                    [userId],
                );
                continue;
            }

            const nextLayer = normalizeListingLayer(next.layer);
            const nextId = Number(next.feature_id);
            let location = null;
            if (nextLayer && isPropertyLayer(nextLayer) && nextLayer === 'LandSale') {
                const result = await realestatePool.query(
                    'SELECT ST_X(ST_PointOnSurface(geom)) AS x_coord, ST_Y(ST_PointOnSurface(geom)) AS y_coord FROM public."LandSale" WHERE fid = $1',
                    [nextId],
                );
                location = result.rows[0];
            } else if (nextLayer && isPropertyLayer(nextLayer)) {
                const result = await realestatePool.query(
                    `SELECT x_coord, y_coord FROM public."${nextLayer}" WHERE fid = $1`,
                    [nextId],
                );
                location = result.rows[0];
            } else if (nextLayer && isValidLayer(nextLayer)) {
                const result = await servicesPool.query(
                    'SELECT x_coord, y_coord FROM public.service_all WHERE discriminator = $1 AND id = $2',
                    [nextLayer, nextId],
                );
                location = result.rows[0];
            }
            await client.query(
                'UPDATE public.users SET service_layer = $1, feature_id = $2, x_coord = $3, y_coord = $4 WHERE user_id = $5',
                [nextLayer, nextId, location?.x_coord ?? null, location?.y_coord ?? null, userId],
            );
        }
        await client.query('COMMIT');
        if (affected.size) clearProviderLinkedCache();
        clearPublicListingCaches();
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

const PRUNE_INTERVAL_MS = 10 * 60 * 1000;
let lastPruneAt = 0;

/**
 * Repair dangling legacy and ownership links left by deletions made before automatic reconciliation was deployed.
 * Runs at most once per PRUNE_INTERVAL_MS; returns the number of links repaired (0 when skipped).
 */
export async function pruneStaleListingOwners() {
    if (Date.now() - lastPruneAt < PRUNE_INTERVAL_MS) return 0;
    lastPruneAt = Date.now();
    await ready;
    const [owners, legacy] = await Promise.all([
        servicesPool.query('SELECT layer, feature_id FROM public.listing_owners'),
        servicesPool.query('SELECT service_layer, feature_id FROM public.users WHERE service_layer IS NOT NULL AND feature_id IS NOT NULL'),
    ]);
    const candidates = new Map();
    const add = (layer, rawId) => {
        const normalized = normalizeListingLayer(layer);
        const id = Number(rawId);
        if (normalized && Number.isSafeInteger(id) && id > 0) candidates.set(`${normalized}:${id}`, { layer: normalized, id });
    };
    owners.rows.forEach((row) => add(row.layer, row.feature_id));
    legacy.rows.forEach((row) => add(row.service_layer, row.feature_id));

    const propertyTargets = [...candidates.values()].filter((x) => isPropertyLayer(x.layer));
    const existing = new Set();
    for (const layer of new Set(propertyTargets.map((x) => x.layer))) {
        const ids = propertyTargets.filter((x) => x.layer === layer).map((x) => x.id);
        const rows = await realestatePool.query(`SELECT fid FROM public."${layer}" WHERE fid = ANY($1::bigint[])`, [ids]);
        rows.rows.forEach((row) => existing.add(`${layer}:${Number(row.fid)}`));
    }
    const serviceTargets = [...candidates.values()].filter((x) => !isPropertyLayer(x.layer));
    if (serviceTargets.length) {
        const rows = await servicesPool.query(
            'SELECT id, discriminator FROM public.service_all WHERE id = ANY($1::bigint[])',
            [[...new Set(serviceTargets.map((x) => x.id))]],
        );
        rows.rows.forEach((row) => existing.add(`${row.discriminator}:${Number(row.id)}`));
    }

    const stale = [...candidates.values()].filter((x) => !existing.has(`${x.layer}:${x.id}`));
    for (const item of stale) await reconcileDeletedListing(item.layer, item.id);
    return stale.length;
}

/** `[{ layer, feature_id }]` owned by this account, oldest first. */
export async function ownedListings(userId) {
    await ready;
    const r = await servicesPool.query(
        'SELECT layer, feature_id FROM public.listing_owners WHERE user_id = $1 ORDER BY created_at, layer, feature_id',
        [userId],
    );
    return r.rows.map((row) => ({ layer: row.layer, feature_id: Number(row.feature_id) }));
}

export async function ownsListing(userId, layer, featureId) {
    await ready;
    const r = await servicesPool.query(
        'SELECT 1 FROM public.listing_owners WHERE user_id = $1 AND layer = $2 AND feature_id = $3',
        [userId, layer, featureId],
    );
    return r.rowCount > 0;
}

/** The active provider account that owns this listing (receives its service requests), or null. */
export async function listingProvider(layer, featureId) {
    await ready;
    const norm = normalizeListingLayer(layer);
    if (!norm || !/^\d+$/.test(String(featureId))) return null;
    const r = await servicesPool.query(
        `SELECT u.user_id, u.full_name, u.phone FROM public.listing_owners o
         JOIN public.users u ON u.user_id = o.user_id
         WHERE o.layer = $1 AND o.feature_id = $2 AND u.role = 'provider' LIMIT 1`,
        [norm, featureId],
    );
    return r.rows[0] || null;
}

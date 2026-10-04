// Who owns which listing: one account may own several services and properties. `layer` is the service discriminator
// or the property table (`ApartRent` / `ApartSale` / `LandSale`); `feature_id` is `service_all.id` or the table's `fid`.
// `users.service_layer` / `users.feature_id` stay as the account's first listing (the provider panel, the admin's
// user editor and the login answer read them); every link written there is mirrored here.
import { servicesPool } from './database.js';
import { PLATFORM_PROPERTY_LAYERS, isValidLayer } from './layers.js';

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

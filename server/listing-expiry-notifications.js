import { realestatePool, servicesPool } from './database.js';
import { LAYER_AR_NAMES, PLATFORM_PROPERTY_LAYERS } from './layers.js';
import { ready as listingOwnersReady } from './listing-owners.js';
import { notifyUserOnce } from './state.js';
import { listingExpiryNotification } from '../lib/listing-expiry-notification.js';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
let timer = null;
let fullCheckRunning = false;
let dedupeSchemaReady;

async function ensureDedupeSchema() {
    if (!dedupeSchemaReady) {
        dedupeSchemaReady = (async () => {
            await servicesPool.query('ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT');
            await servicesPool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_uq
                ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL
            `);
        })().catch((err) => {
            dedupeSchemaReady = null;
            throw err;
        });
    }
    return dedupeSchemaReady;
}

async function expiredServices(userId) {
    const result = await servicesPool.query(`
        SELECT o.user_id, s.discriminator AS layer, s.id AS feature_id, s.end_date, s.name
        FROM public.service_all s
        JOIN public.listing_owners o
          ON o.layer = s.discriminator AND o.feature_id = s.id
        JOIN public.users u ON u.user_id = o.user_id AND u.role = 'provider'
        WHERE s.end_date IS NOT NULL AND s.end_date < CURRENT_DATE
          AND ($1::int IS NULL OR o.user_id = $1)
    `, [userId]);
    return result.rows;
}

async function expiredProperties(userId) {
    const ownerRows = await servicesPool.query(
        `SELECT o.layer, o.feature_id, o.user_id
         FROM public.listing_owners o
         JOIN public.users u ON u.user_id = o.user_id AND u.role = 'provider'
         WHERE o.layer = ANY($1::text[])
           AND ($2::int IS NULL OR o.user_id = $2)`,
        [PLATFORM_PROPERTY_LAYERS, userId],
    );
    const ownersByLayer = new Map(PLATFORM_PROPERTY_LAYERS.map((layer) => [layer, new Map()]));
    for (const owner of ownerRows.rows) {
        ownersByLayer.get(owner.layer)?.set(String(owner.feature_id), Number(owner.user_id));
    }

    const rows = [];
    for (const layer of PLATFORM_PROPERTY_LAYERS) {
        const owners = ownersByLayer.get(layer);
        if (!owners?.size) continue;
        const result = await realestatePool.query(
            `SELECT fid AS feature_id, name, end_date
             FROM public."${layer}"
             WHERE fid = ANY($1::bigint[]) AND end_date IS NOT NULL AND end_date < CURRENT_DATE`,
            [[...owners.keys()]],
        );
        rows.push(...result.rows.map((row) => ({
            ...row,
            layer,
            user_id: owners.get(String(row.feature_id)),
        })));
    }
    return rows;
}

async function notifyExpiredListings(userId = null) {
    if (userId === null && fullCheckRunning) return;
    if (userId === null) fullCheckRunning = true;
    try {
        await ensureDedupeSchema();
        await listingOwnersReady;
        const listings = [...await expiredServices(userId), ...await expiredProperties(userId)];
        for (const listing of listings) {
            const typeName = Object.hasOwn(LAYER_AR_NAMES, listing.layer)
                ? LAYER_AR_NAMES[listing.layer]
                : 'إعلان';
            const notification = listingExpiryNotification({ ...listing, typeName });
            await notifyUserOnce(
                listing.user_id,
                notification.title,
                notification.message,
                notification.type,
                notification.link,
                notification.dedupeKey,
            );
        }
    } catch (err) {
        console.error(
            userId === null
                ? '❌ تعذر فحص الإعلانات المنتهية وإشعار مزوديها:'
                : `❌ تعذر فحص الإعلانات المنتهية للمزوّد ${userId}:`,
            err.message,
        );
    } finally {
        if (userId === null) fullCheckRunning = false;
    }
}

/** Check one provider's expired listings immediately, for example when they open "My listings". */
export function notifyExpiredListingsForUser(userId) {
    if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) {
        throw new TypeError('A valid provider user id is required.');
    }
    return notifyExpiredListings(Number(userId));
}

/** Run a low-frequency background check. Opening "My listings" still checks that provider immediately. */
export function startListingExpiryNotifications() {
    if (timer) return;
    timer = setInterval(() => void notifyExpiredListings(), CHECK_INTERVAL_MS);
    timer.unref();
}

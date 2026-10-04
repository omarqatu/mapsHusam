// The admin's "show & hide" setting as the server applies it: hidden layers are left out of every public answer.
import { servicesPool } from './database.js';
import { activeAdminUidFromToken, bearerToken } from './auth.js';
import { parseHiddenLayers } from '../lib/listing-rules.js';

export const VISIBILITY_KEY = 'settings.visibility';
const CACHE_MS = 30 * 1000;
let cache = { hidden: new Set(), expiresAt: 0 };

/** Hidden layer keys (`rent` / `sale` / `land` / discriminators). A failed read keeps the last known value. */
export async function getHiddenLayers() {
    if (Date.now() < cache.expiresAt) return cache.hidden;
    try {
        const r = await servicesPool.query('SELECT content_value FROM public.platform_content WHERE content_key = $1', [VISIBILITY_KEY]);
        cache = { hidden: parseHiddenLayers(r.rows[0]?.content_value), expiresAt: Date.now() + CACHE_MS };
    } catch (err) {
        console.warn('⚠️ تعذر قراءة إعداد الإظهار والإخفاء:', err.message);
        cache.expiresAt = Date.now() + 5000;
    }
    return cache.hidden;
}

/** Called when an admin saves the setting, so the next public request already follows it. */
export function clearVisibilityCache() {
    cache.expiresAt = 0;
}

/** Admins see everything (they manage hidden and withdrawn listings); everyone else gets the public view. */
export async function requestIsAdmin(req, token = bearerToken(req)) {
    return !!(await activeAdminUidFromToken(token));
}

/** Hidden layers for this request: none for an admin. */
export async function hiddenLayersFor(req) {
    return (await requestIsAdmin(req)) ? new Set() : getHiddenLayers();
}

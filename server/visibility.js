// The admin's "show & hide" setting as the server applies it: hidden layers are left out of every public answer, and a
// visitor without an account gets listings without their phone / WhatsApp unless the admin allows it.
import { servicesPool } from './database.js';
import { bearerToken, sessionFromToken } from './auth.js';
import { parseVisibilitySettings } from '../lib/listing-rules.js';

export const VISIBILITY_KEY = 'settings.visibility';
const CACHE_MS = 30 * 1000;
let cache = { settings: parseVisibilitySettings(null), expiresAt: 0 };

/** `{ hidden, visitorContact }`. A failed read keeps the last known value. */
export async function getVisibilitySettings() {
    if (Date.now() < cache.expiresAt) return cache.settings;
    try {
        const r = await servicesPool.query('SELECT content_value FROM public.platform_content WHERE content_key = $1', [VISIBILITY_KEY]);
        cache = { settings: parseVisibilitySettings(r.rows[0]?.content_value), expiresAt: Date.now() + CACHE_MS };
    } catch (err) {
        console.warn('⚠️ تعذر قراءة إعداد الإظهار والإخفاء:', err.message);
        cache.expiresAt = Date.now() + 5000;
    }
    return cache.settings;
}

/** Hidden layer keys (`rent` / `sale` / `land` / discriminators). */
export async function getHiddenLayers() {
    return (await getVisibilitySettings()).hidden;
}

/** Called when an admin saves the setting, so the next public request already follows it. */
export function clearVisibilityCache() {
    cache.expiresAt = 0;
}

/**
 * Who is asking and what the rules leave them: `hidden` = layers to leave out (none for an admin, who manages them),
 * `hideContact` = drop phone / WhatsApp (a visitor without an account, unless the admin allows it).
 */
export async function viewerRules(token) {
    const [session, settings] = await Promise.all([sessionFromToken(token), getVisibilitySettings()]);
    const isAdmin = session?.role === 'admin';
    return {
        isAdmin,
        signedIn: !!session,
        hidden: isAdmin ? new Set() : settings.hidden,
        hideContact: !session && !settings.visitorContact,
    };
}

export const viewerRulesFor = (req) => viewerRules(bearerToken(req));

/** Hidden layers for this request: none for an admin. */
export async function hiddenLayersFor(req) {
    return (await viewerRulesFor(req)).hidden;
}

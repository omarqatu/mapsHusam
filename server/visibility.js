// The admin's "show & hide" setting as the server applies it: hidden layers are left out of every public answer, and a
// visitor without an account gets listings without their phone / WhatsApp unless the admin allows it.
import { servicesPool } from './database.js';
import { bearerToken, sessionFromToken } from './auth.js';
import { parseVisibilitySettings } from '../lib/listing-rules.js';
import { FIXED_LOCATION_SERVICE_KEYS, SERVICE_TYPE_KEYS } from './layers.js';

export const VISIBILITY_KEY = 'settings.visibility';
const CACHE_MS = 30 * 1000;
// Add newly registered technician services here while migrating older saved visibility settings.
const MOVABLE_LAYER_MIGRATION_VERSION = 1;
const MOVABLE_LAYER_MIGRATION_KEYS = ['tile_mason'];
let cache = { settings: parseVisibilitySettings(null), expiresAt: 0 };

function withProviderLocationPolicy(settings, raw) {
    let stored;
    try { stored = raw && typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { stored = null; }
    const saved = Array.isArray(stored?.providerMovableLayers) ? stored.providerMovableLayers : null;
    const movable = saved ?? SERVICE_TYPE_KEYS.filter((key) => !FIXED_LOCATION_SERVICE_KEYS.has(key));
    if (Number(stored?.providerMovableLayersVersion || 0) < MOVABLE_LAYER_MIGRATION_VERSION) {
        movable.push(...MOVABLE_LAYER_MIGRATION_KEYS.filter((key) => !FIXED_LOCATION_SERVICE_KEYS.has(key)));
    }
    const providerMovableLayers = new Set(movable
        .filter((key) => typeof key === 'string' && SERVICE_TYPE_KEYS.includes(key)));
    return { ...settings, providerMovableLayers };
}
cache.settings = withProviderLocationPolicy(cache.settings, null);

/** `{ hidden, visitorContact }`. A failed read keeps the last known value. */
export async function getVisibilitySettings() {
    if (Date.now() < cache.expiresAt) return cache.settings;
    try {
        const r = await servicesPool.query('SELECT content_value FROM public.platform_content WHERE content_key = $1', [VISIBILITY_KEY]);
        const raw = r.rows[0]?.content_value;
        cache = { settings: withProviderLocationPolicy(parseVisibilitySettings(raw), raw), expiresAt: Date.now() + CACHE_MS };
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

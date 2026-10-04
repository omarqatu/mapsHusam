// What the public may see of a listing, as one rule shared by the SQL endpoints and the GeoServer proxy.
// Pure functions (no database, no express) so they can be unit-tested with `node --test`.
//
// A listing's `status` (set by the provider or the admin):
//   0 available     — shown.
//   1 unavailable   — a service is still shown (marked "not available right now"); a property is not shown.
//   2 withdrawn     — never shown to the public (a sold plot, a cancelled service). Only an admin sees it.
// `end_date` in the past = the listing ended: not shown. Work hours never hide a listing any more: a service that is
// closed right now is shown as closed (`auto_status` = 1, computed by the database trigger).

export const LISTING_STATUS = { available: 0, unavailable: 1, withdrawn: 2 };
export const PROPERTY_TABLES = ['ApartRent', 'ApartSale', 'LandSale'];
/** The admin's "show & hide" keys for the property layers (web/src/features/map/targets.ts `targetKey`). */
export const PROPERTY_KEY_TO_TABLE = { rent: 'ApartRent', sale: 'ApartSale', land: 'LandSale' };
const TABLE_TO_PROPERTY_KEY = Object.fromEntries(Object.entries(PROPERTY_KEY_TO_TABLE).map(([k, v]) => [v, k]));

/** `settings.visibility` text → the set of hidden layer keys (`rent` / `sale` / `land` / service discriminators). */
export function parseHiddenLayers(raw) {
    if (!raw) return new Set();
    try {
        const data = JSON.parse(raw);
        const list = data && Array.isArray(data.hiddenLayers) ? data.hiddenLayers : [];
        return new Set(list.filter((k) => typeof k === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(k)));
    } catch {
        return new Set();
    }
}

/** A layer as the API / GeoServer names it (`ApartRent`, `plumber`, …) → its show & hide key. */
export const visibilityKey = (layer) => TABLE_TO_PROPERTY_KEY[layer] || layer;

export const isLayerHidden = (layer, hidden) => hidden.has(visibilityKey(String(layer || '').trim()));

/** The hidden service discriminators (everything hidden that is not a property layer). */
export const hiddenDiscriminators = (hidden) => [...hidden].filter((k) => !PROPERTY_KEY_TO_TABLE[k]).sort();

/** SQL condition (no parameters) for rows the public may see. */
export function publicListingSql(isProperty) {
    const statusPart = isProperty ? 'status = 0' : 'status IN (0, 1)';
    return `(${statusPart} AND (end_date IS NULL OR end_date >= CURRENT_DATE))`;
}

/** ORDER BY head that puts what can be used right now first: available and open, then closed / unavailable. */
export const AVAILABLE_FIRST_SQL = '(CASE WHEN status = 0 AND COALESCE(auto_status, 0) = 0 THEN 0 ELSE 1 END)';

const cqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** ECQL for the same rule on a GeoServer layer, plus the hidden service types for `service_all`. */
export function publicListingCql(layer, { hidden, today }) {
    const isProperty = PROPERTY_TABLES.includes(layer);
    const parts = [
        isProperty ? 'status = 0' : 'status IN (0,1)',
        `(end_date IS NULL OR end_date >= ${cqlString(today)})`,
    ];
    const hiddenTypes = layer === 'service_all' ? hiddenDiscriminators(hidden) : [];
    if (hiddenTypes.length) parts.push(`discriminator NOT IN (${hiddenTypes.map(cqlString).join(',')})`);
    return parts.join(' AND ');
}

/** Today in the server's local time zone as YYYY-MM-DD (the database compares against CURRENT_DATE the same way). */
export function localIsoDate(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Query keys of a GeoServer read that would replace or loosen the forced filter, refused for the public on data layers.
const FILTER_KEYS = new Set(['cql_filter', 'filter', 'featureid', 'resourceid', 'viewparams', 'env']);

/**
 * Rewrites the query string of a public (non-admin) GeoServer read of ONE listing layer so that GeoServer itself only
 * returns what the public may see. `query` = parsed query object (keys in any case). Returns `{ query }` (new object)
 * or `{ status, error }` to refuse. `bbox` is folded into the filter: GeoServer refuses BBOX together with CQL_FILTER.
 */
export function publicProxyQuery(query, layer, { hidden, today }) {
    if (isLayerHidden(layer, hidden)) return { status: 404, error: 'layer hidden' };
    const out = {};
    let bbox = null;
    for (const [key, value] of Object.entries(query)) {
        const k = key.toLowerCase();
        if (FILTER_KEYS.has(k)) return { status: 403, error: 'filter not allowed' };
        if (Array.isArray(value)) return { status: 400, error: 'repeated parameter' };
        if (k === 'bbox') bbox = String(value);
        else out[key] = value;
    }
    let cql = publicListingCql(layer, { hidden, today });
    if (bbox !== null) {
        const parts = bbox.split(',').map((s) => s.trim());
        const nums = parts.slice(0, 4).map(Number);
        if (parts.length < 4 || nums.some((n) => !Number.isFinite(n))) return { status: 400, error: 'bad bbox' };
        const crs = parts[4] || String(query.srsName || query.srsname || query.SRSNAME || 'EPSG:28191');
        if (!/^[A-Za-z0-9:._/-]{1,80}$/.test(crs)) return { status: 400, error: 'bad bbox' };
        cql = `BBOX(geom,${nums.join(',')},${cqlString(crs)}) AND ${cql}`;
    }
    out.CQL_FILTER = cql;
    return { query: out };
}

// Which GeoServer requests a non-admin may send through /geoserver-proxy: the reads the map uses, nothing else.
// Admin writes (WFS-T POST) are decided by the route; this only judges a visitor's / signed-in user's request.

// GeoServer reads parameter NAMES in any case, so every check here compares lower-cased names.
const VISITOR_REQUESTS = {
    wms: new Set(['getmap', 'getfeatureinfo', 'getlegendgraphic', 'getcapabilities']),
    wfs: new Set(['getfeature', 'getcapabilities', 'describefeaturetype']),
};
// Requests that read layer data: they must name their layer(s) in a parameter the route checks (typeName, layers…),
// otherwise GeoServer could be asked for a feature by id alone and the layer whitelist / listing filter never runs.
const LAYER_REQUESTS = new Set(['getmap', 'getfeatureinfo', 'getlegendgraphic', 'getfeature', 'describefeaturetype']);
// Ways to address features by id without a layer parameter (WFS 2.0 resourceId, stored query GetFeatureById).
const ID_KEYS = new Set(['resourceid', 'storedquery_id']);
// The endpoints the map uses: /ows, /wfs, /wms, optionally after a workspace. Matched on the RAW path (no % escapes).
const VISITOR_PATH = /^\/(?:[A-Za-z0-9_]+\/)?(ows|wfs|wms)$/i;
// GeoServer upper-cases parameter names in Java, which folds some non-ASCII letters into ASCII ones ("ſ" → "S",
// "ı" → "I") while JavaScript's toLowerCase leaves them alone: "layerſ" would be LAYERS to GeoServer and unknown here.
// So a visitor's parameter names must be plain ASCII.
const PARAM_NAME = /^[A-Za-z0-9_.:-]{1,64}$/;

const deny = (status, error) => ({ status, error });

/**
 * Judges a non-admin proxy request. `query` is the parsed query string, `path` the raw (still encoded) path after
 * /geoserver-proxy, `layers` the layer names the route found in it. Returns `{ ok: true }` or `{ status, error }`.
 * Every value must be a single string: the route then rebuilds the forwarded query from exactly these values, so
 * GeoServer never sees a parameter this check did not (repeats, nested keys, or anything past the parser's limit).
 */
export function visitorProxyCheck(query, path, layers) {
    const params = new Map();
    for (const [key, value] of Object.entries(query || {})) {
        if (typeof value !== 'string') return deny(400, 'repeated or nested parameter');
        if (!PARAM_NAME.test(key)) return deny(400, 'bad parameter name');
        const k = key.toLowerCase();
        if (params.has(k)) return deny(400, 'repeated parameter');
        params.set(k, value);
    }
    for (const k of params.keys()) {
        if (ID_KEYS.has(k) || k.startsWith('sld')) return deny(403, 'parameter not allowed');
    }
    const endpoint = VISITOR_PATH.exec(path)?.[1].toLowerCase();
    if (!endpoint) return deny(403, 'path not allowed');
    const service = (params.get('service') || (endpoint === 'ows' ? '' : endpoint)).toLowerCase();
    const request = (params.get('request') || '').toLowerCase();
    if (!Object.hasOwn(VISITOR_REQUESTS, service) || !VISITOR_REQUESTS[service].has(request)) {
        return deny(403, 'request not allowed');
    }
    if (LAYER_REQUESTS.has(request) && !layers.length) return deny(403, 'layer required');
    return { ok: true };
}

// Link previews for a listing's own page (/l/<type>/<id>): what WhatsApp / Facebook show when the link is shared.
// Pure functions; the route lives in server/frontend.js. Never puts a phone or WhatsApp number in the page.
import { PROPERTY_KEY_TO_TABLE } from './listing-rules.js';
import { picList } from './listing-edit.js';

const CURRENCY_AR = { USD: 'دولار', ILS: 'شيقل', JOD: 'دينار' };
const IMAGE_PATH = /^\/(?!.*\.\.)(?:api\/listing-photos|pic)\/[^?#]*\.(?:jpe?g|png|webp|gif)$/i;
const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** Which table a `/l/<key>` names: a property layer (rent | sale | land) or a known service type; else null. */
export function listingSource(key, serviceKeys) {
    if (Object.hasOwn(PROPERTY_KEY_TO_TABLE, key)) return { table: PROPERTY_KEY_TO_TABLE[key], isProperty: true };
    if (serviceKeys.includes(key)) return { table: 'service_all', isProperty: false, discriminator: key };
    return null;
}

/** A listing id is a positive integer (a property fid or a service id). */
export const listingId = (raw) => (/^[1-9]\d{0,9}$/.test(String(raw)) ? Number(raw) : null);

/** The first of the listing's own pictures served by us, as an absolute URL; else the app icon. */
export function ogImage(pic, origin) {
    const own = picList(pic).find((p) => IMAGE_PATH.test(p) || (p.startsWith(origin + '/') && IMAGE_PATH.test(p.slice(origin.length))));
    if (own) return own.startsWith('/') ? origin + own : own;
    return `${origin}/icons/icon-512.png`;
}

/** Title and description, the same words the app shows on the card (its name, or «<type> في <place>»). */
export function ogText(row, typeName) {
    const place = text(row.location) || text(row.village_a) || text(row.gov_a);
    const title = text(row.name) || text(row.location_name) || (place ? `${typeName} في ${place}` : typeName);
    const price = Number(row.price) > 0 ? `${Number(row.price).toLocaleString('en-US')} ${CURRENCY_AR[row.currency] || ''}`.trim() : '';
    const description = [typeName, place, price].filter(Boolean).join(' · ');
    return { title, description: text(row.des) ? `${description} — ${text(row.des).slice(0, 160)}` : description };
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * index.html with this listing's title, description, url and image: replaces the page's own <title>, description and
 * og:title / og:description, and adds og:url, og:image and the large-picture card. Every value is escaped.
 */
export function withListingMeta(html, { title, description, url, image, siteName }) {
    const t = escapeHtml(title);
    const d = escapeHtml(description);
    const meta = (attr, name, content) => `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`;
    return html
        .replace(/<title>[^<]*<\/title>/, `<title>${t} · ${escapeHtml(siteName)}</title>`)
        .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, meta('name', 'description', description))
        .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, meta('property', 'og:title', title))
        .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}" />`)
        .replace('</head>', `${meta('property', 'og:url', url)}${meta('property', 'og:image', image)}`
            + `${meta('property', 'og:site_name', siteName)}${meta('name', 'twitter:card', 'summary_large_image')}</head>`);
}

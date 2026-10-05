import { formatNumber } from '@/lib/format';
import type { MediaItem as GalleryItem } from '@/components/ui/MediaGallery';
import { FUEL_FIELDS, roadBarrierStatus, type FuelField } from '../config';
import type { MapTarget } from '../targets';

// Pure helpers behind the feature details card (legacy popup.js + shared-utils.js), testable without a map.

export type Props = Record<string, unknown>;

export type SelectedKind =
  | MapTarget
  /** A bare location opened from a shared `?x=&y=` link. */
  | { kind: 'location' };

/** Snapshot of the clicked feature — plain data, so the card doesn't hold OpenLayers objects. */
export interface SelectedFeature {
  kind: SelectedKind;
  /** Feature id used by ratings / contact logs / provider links (legacy displayFeatureId). */
  id: string | null;
  props: Props;
  coordinate: [number, number];
  /** Length / area measured from the drawn geometry (lines and polygons only). */
  measure?: { kind: 'length'; meters: number } | { kind: 'area'; squareMeters: number };
}

const present = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';
export const text = (v: unknown) => (present(v) ? String(v).trim() : '');

/** Case/punctuation-insensitive property read (legacy getCaseInsensitiveProp). */
export function prop(props: Props, key: string): unknown {
  if (props[key] !== undefined) return props[key];
  const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(key);
  const found = Object.keys(props).find((k) => norm(k) === target);
  return found === undefined ? undefined : props[found];
}

export function firstProp(props: Props, keys: string[]): unknown {
  for (const k of keys) {
    const v = prop(props, k);
    if (present(v)) return v;
  }
  return undefined;
}

/** props.id → fid → feature_id → last segment of the WFS feature id ("service_all.123" → "123"). */
export function resolveFeatureId(props: Props, olId: string | number | undefined): string | null {
  for (const k of ['id', 'fid', 'feature_id']) if (present(props[k])) return String(props[k]);
  if (olId === undefined || olId === '') return null;
  const parts = String(olId).split('.');
  return parts[parts.length - 1] || null;
}

// --- media -----------------------------------------------------------------------------------
const MEDIA = {
  pic: [
    'pic',
    'image',
    'images',
    'photo',
    'photos',
    'img',
    'imgs',
    'picture',
    'pictures',
    'pic_url',
    'image_url',
    'img_url',
    'photo_url',
    'picture_url',
  ],
  video: ['video', 'vid', 'movie', 'video_url', 'clip', 'youtube'],
  details1: ['details_link_1', 'detailsLink1', 'link_1', 'details_url_1', 'details1'],
  details2: ['details_link_2', 'detailsLink2', 'link_2', 'details_url_2', 'details2'],
};

/**
 * A URL from feature data that is safe to put in href/src: legacy clean-up (embedded src="…", missing
 * protocol, http → https because the CSP only allows https media), then only https:// survives — or a picture
 * uploaded to this server (`/api/listing-photos/…`).
 */
export function safeMediaUrl(raw: unknown): string | null {
  let v = text(raw);
  if (!v || v === '#' || /^(undefined|null)$/i.test(v)) return null;
  const embedded = v.match(/(?:src|href)=["']([^"']+)["']/i);
  if (embedded) v = embedded[1];
  v = v.replace(/^['"]|['"]$/g, '').trim();
  // A picture a provider uploaded: served by this server (same origin).
  if (/^\/api\/listing-photos\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(v)) return v;
  if (v.startsWith('//')) v = `https:${v}`;
  else if (v.startsWith('http://')) v = `https://${v.slice(7)}`;
  else if (!/^https:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A pic field may hold one URL, a list (comma/newline/|/;), JSON, or an <img> tag (legacy parseUrlList). */
export function parseUrlList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.flatMap(parseUrlList);
  let s = text(raw);
  if (!s || s === '#' || /^(undefined|null)$/i.test(s)) return [];
  try {
    const parsed: unknown = JSON.parse(s);
    if (typeof parsed === 'string' || Array.isArray(parsed)) return parseUrlList(parsed);
    if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>;
      return parseUrlList(o.url ?? o.src ?? o.href ?? o.value ?? '');
    }
  } catch {
    /* plain text */
  }
  const embedded = s.match(/(?:src|href)=["']([^"']+)["']/i);
  if (embedded) s = embedded[1];
  return s
    .replace(/\[(.*?)]/g, '$1')
    .split(/[\r\n|,;]+/)
    .map((x) => x.trim().replace(/^['"]|['"]$/g, ''))
    .filter((x) => x && x !== '#' && !/^(undefined|null)$/i.test(x));
}

/** Video id of a YouTube link: watch (v may not be first), youtu.be, embed, shorts, live, m./music. hosts. */
export function youtubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  const valid = (id: string | null | undefined) => (id && /^[\w-]{11}$/.test(id) ? id : null);
  if (host === 'youtu.be') return valid(u.pathname.split('/')[1]);
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
  if (u.pathname === '/watch') return valid(u.searchParams.get('v'));
  const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]+)/);
  return m ? valid(m[1]) : null;
}
export const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
export const isVideoFileUrl = (url: string) => /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);

/** Like the gallery's MediaItem, but a link carries an i18n key (translated by the card). */
export type MediaItem =
  | { type: 'image'; url: string }
  | { type: 'youtube'; id: string }
  | { type: 'video'; url: string }
  | { type: 'link'; url: string; labelKey: string };

/**
 * Everything to show under the details, in legacy order: pictures, video, details link 1, details link 2. A complete
 * before / after pair is not in the list: it is shown as a pair of its own (`beforeAfterPair`).
 */
export function collectMedia(props: Props): MediaItem[] {
  const out: MediaItem[] = [];
  const asVideo = (url: string, labelKey: string): MediaItem => {
    const yt = youtubeId(url);
    if (yt) return { type: 'youtube', id: yt };
    if (isVideoFileUrl(url)) return { type: 'video', url };
    return { type: 'link', url, labelKey };
  };
  for (const raw of parseUrlList(firstProp(props, MEDIA.pic))) {
    const url = safeMediaUrl(raw);
    if (url) out.push({ type: 'image', url });
  }
  const video = safeMediaUrl(firstProp(props, MEDIA.video));
  if (video) out.push(asVideo(video, 'popup.watchVideo'));
  const pairShown = beforeAfterPair(props) !== null;
  for (const [keys, labelKey] of [
    [MEDIA.details1, 'popup.moreDetails1'],
    [MEDIA.details2, 'popup.moreDetails2'],
  ] as const) {
    if (pairShown) break;
    const url = safeMediaUrl(firstProp(props, keys));
    if (!url) continue;
    out.push(isImageUrl(url) ? { type: 'image', url } : asVideo(url, labelKey));
  }
  // The same picture / video is often filled in two fields; show it once.
  const seen = new Set<string>();
  return out.filter((m) => {
    const k = m.type === 'youtube' ? `y:${m.id}` : `${m.type}:${m.url}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** `collectMedia` output for `<MediaGallery>`: link labels are translated here. */
export function labelMedia(items: MediaItem[], t: (key: string) => string): GalleryItem[] {
  return items.map((m) => (m.type === 'link' ? { type: 'link', url: m.url, label: t(m.labelKey) } : m));
}

/** The two "more details" links (legacy before / after), each a safe https URL or null. */
export function detailLinks(props: Props): [string | null, string | null] {
  return [safeMediaUrl(firstProp(props, MEDIA.details1)), safeMediaUrl(firstProp(props, MEDIA.details2))];
}

/**
 * A provider's before / after: both "details" fields hold a picture or a video (safe URLs), else null. Legacy data also
 * keeps plain links there (a Facebook page, a website): those stay "more details" links, never labelled before / after.
 */
export function beforeAfterPair(props: Props): { before: string; after: string } | null {
  const [before, after] = detailLinks(props);
  const visual = (url: string | null) => sideMedia(url, '').some((m) => m.type !== 'link');
  return before && after && visual(before) && visual(after) ? { before, after } : null;
}

/** One before/after side as media: an image, a YouTube/video file, or a link. */
export function sideMedia(url: string | null, linkLabelKey: string): MediaItem[] {
  if (!url) return [];
  const [m] = collectMedia({ details_link_1: url });
  return m ? [m.type === 'link' ? { ...m, labelKey: linkLabelKey } : m] : [];
}

export type MediaView = 'photos' | 'beforeAfter';

/**
 * What the listing's media opens on: the provider's choice (`media_default`), when it can be honoured — before / after
 * needs the pair, and with no other media the pair is all there is.
 */
export function mediaDefault(props: Props): MediaView {
  if (!beforeAfterPair(props)) return 'photos';
  if (text(props.media_default) === 'before_after') return 'beforeAfter';
  return collectMedia(props).length === 0 ? 'beforeAfter' : 'photos';
}

// --- availability ----------------------------------------------------------------------------
export type WorkHours =
  { allDay: true } | { allDay: false; from: string; to: string } | { allDay: false; raw: string };

/** "08:00-17:30" → from/to; empty or "00:00-23:59" → all day; anything else shown as typed. */
export function parseWorkHours(v: unknown): WorkHours {
  const s = text(v);
  if (!s || s === '00:00-23:59') return { allDay: true };
  const parts = s.split('-').map((p) => p.trim());
  if (parts.length === 2 && parts.every((p) => /^\d{1,2}:\d{2}$/.test(p)))
    return { allDay: false, from: parts[0], to: parts[1] };
  return { allDay: false, raw: s };
}

/** "Available 8:00 AM to 5:30 PM" / "24 hours" / the text as typed. */
export function hoursLabel(
  v: unknown,
  t: (key: string, o?: Record<string, unknown>) => string,
  locale: string,
) {
  const h = parseWorkHours(v);
  if (h.allDay) return t('popup.allDay');
  // A lone "0" is the column's placeholder, not a schedule — show nothing rather than a stray zero.
  if ('raw' in h) return h.raw === '0' ? '' : h.raw;
  return t('popup.availableFromTo', { from: formatClock(h.from, locale), to: formatClock(h.to, locale) });
}

/** "HH:MM" in the UI language, e.g. ar "٨:٠٠ ص" / en "8:00 AM". */
export function formatClock(hhmm: string, locale: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2000, 0, 1, h, m),
  );
}

/** auto_status 0 = open now (computed by the DB trigger from work hours). */
export const isOpenNow = (autoStatus: unknown) => Number.parseInt(String(autoStatus), 10) === 0;

/** `status` of a listing (server lib/listing-rules.js): 0 available, 1 unavailable for now, 2 withdrawn. */
export const LISTING_STATUS = { available: 0, unavailable: 1, withdrawn: 2 } as const;

/**
 * What a card says about a listing right now. `unavailable` = the provider marked it so (still listed);
 * `withdrawn` only reaches an admin (the server never sends it to the public). `null` = nothing known (no auto_status).
 */
export type Availability = 'open' | 'closed' | 'unavailable' | 'withdrawn';
export function availability(props: Props): Availability | null {
  const status = Number.parseInt(text(props.status), 10);
  if (status === LISTING_STATUS.withdrawn) return 'withdrawn';
  if (status === LISTING_STATUS.unavailable) return 'unavailable';
  if (text(props.auto_status) === '') return null;
  return isOpenNow(props.auto_status) ? 'open' : 'closed';
}

/** Colour token of each state (text colour, or a pill's dot). */
export const AVAILABILITY_TONE: Record<Availability, string> = {
  open: 'var(--color-ok)',
  closed: 'var(--color-danger)',
  unavailable: 'var(--color-warn)',
  withdrawn: 'var(--color-muted)',
};

export const availabilityLabelKey = (a: Availability) => `popup.availability.${a}` as const;

/** diesel / banzen95 / banzen98: 0 = available, anything else = not available. */
export { FUEL_FIELDS };
export const fuelAvailable = (props: Props, key: FuelField) =>
  Number.parseInt(String(prop(props, key)), 10) === 0;

/** Road checkpoint: `stop` = inbound, `stop2` = outbound (missing stop2 → "not set"). */
export function barrierDirections(props: Props) {
  const stop2 = prop(props, 'stop2');
  return {
    inbound: roadBarrierStatus(prop(props, 'stop')),
    outbound: present(stop2) ? roadBarrierStatus(stop2) : null,
  };
}

// --- contact ---------------------------------------------------------------------------------
/** WhatsApp link: digits only, no leading 00, with the legacy greeting. */
export function whatsappLink(number: string, message: string) {
  let digits = number.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits) return null;
  const u = new URL('https://api.whatsapp.com/send');
  u.searchParams.set('phone', digits);
  u.searchParams.set('text', message);
  return u.toString();
}

export function telLink(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : null;
}

/** Legacy share link: current page + ?x=&y= (Palestine Grid), optionally &z= (zoom) for the share tool. */
export function locationShareLink(
  origin: string,
  pathname: string,
  [x, y]: readonly number[],
  zoom?: number,
) {
  const u = new URL(pathname, origin);
  u.searchParams.set('x', String(x));
  u.searchParams.set('y', String(y));
  if (zoom !== undefined) u.searchParams.set('z', String(zoom));
  return u.toString();
}

/**
 * "50,000 USD" for a row that has a price, null when there is no positive price. `defaultCurrency` is used when the row
 * names none (a service's price has no currency column: it is dollars, see `priceCurrencyDefault`).
 */
export function priceLabel(
  props: Props,
  t: (key: string) => string,
  language: string,
  defaultCurrency?: string,
): string | null {
  const price = Number(props.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const raw = text(props.currency);
  const code = currencyCode(raw) ?? (raw ? null : currencyCode(defaultCurrency));
  // An unknown value typed by hand is shown as it is (React escapes it); a known one in the reader's language.
  const currency = code ? t(CURRENCY_KEYS[code]) : raw;
  return `${formatNumber(price, language)} ${currency}`.trim();
}

/** `USD` / `ILS` / `JOD` from what rows hold: codes in any case, `$`, `₪`, `د.أ` or the Arabic names (Husam, q1). */
export function currencyCode(value: unknown): 'USD' | 'ILS' | 'JOD' | null {
  const v = String(value ?? '')
    .trim()
    .toUpperCase();
  if (!v) return null;
  if (['USD', '$', 'دولار'].includes(v)) return 'USD';
  if (['ILS', 'NIS', '₪', 'شيكل', 'شيقل'].includes(v)) return 'ILS';
  if (['JOD', 'د.أ', 'دينار'].includes(v)) return 'JOD';
  return null;
}

export const CURRENCY_KEYS: Record<string, string> = {
  USD: 'popup.currency.USD',
  ILS: 'popup.currency.ILS',
  JOD: 'popup.currency.JOD',
};

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
 * protocol, http → https because the CSP only allows https media), then only https:// survives.
 */
export function safeMediaUrl(raw: unknown): string | null {
  let v = text(raw);
  if (!v || v === '#' || /^(undefined|null)$/i.test(v)) return null;
  const embedded = v.match(/(?:src|href)=["']([^"']+)["']/i);
  if (embedded) v = embedded[1];
  v = v.replace(/^['"]|['"]$/g, '').trim();
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

/** Everything to show under the details, in legacy order: pictures, video, details link 1, details link 2. */
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
  for (const [keys, labelKey] of [
    [MEDIA.details1, 'popup.moreDetails1'],
    [MEDIA.details2, 'popup.moreDetails2'],
  ] as const) {
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

/** "50,000 USD" for real-estate rows, null when there is no positive price. */
export function priceLabel(props: Props, t: (key: string) => string, language: string): string | null {
  const price = Number(props.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const currency = CURRENCY_KEYS[text(props.currency)];
  return `${formatNumber(price, language)} ${currency ? t(currency) : ''}`.trim();
}

export const CURRENCY_KEYS: Record<string, string> = {
  USD: 'popup.currency.USD',
  ILS: 'popup.currency.ILS',
  JOD: 'popup.currency.JOD',
};

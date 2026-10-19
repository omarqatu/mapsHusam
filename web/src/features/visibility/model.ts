import { ALL_TARGETS, targetFromKey, targetKey, type MapTarget } from '@/features/map/targets';
import fixedLocationServices from '../../../../shared/fixed-location-services.json';

// What the public sees: the admin hides layers (map types) and whole sections of the site. Stored on the server as one
// JSON value under `settings.visibility` (platform_content), applied by every page through `useVisibility`.
// Road status / fuel status have no switch of their own: they follow their layers (road_barriers, fuel_stations).

export const VISIBILITY_KEY = 'settings.visibility';

/** Parts of the site that are not a layer. */
export const SECTION_IDS = ['ticker', 'featured', 'stats', 'requests'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** Admin-editable maximum map resolution for each manual listing-rating band. Larger values draw farther out. */
export const RATING_BANDS = [
  { id: '10', min: 10, max: 10, label: '10' },
  { id: '9.9', min: 9.9, max: 9.9, label: '9.9' },
  { id: '9', min: 9, max: 9.9, label: '9–9.8' },
  { id: '8', min: 8, max: 9, label: '8–8.9' },
  { id: '7', min: 7, max: 8, label: '7–7.9' },
  { id: '6', min: 6, max: 7, label: '6–6.9' },
  { id: '5', min: 5, max: 6, label: '5–5.9' },
  { id: '4', min: 4, max: 5, label: '4–4.9' },
  { id: '3', min: 3, max: 4, label: '3–3.9' },
  { id: '2', min: 2, max: 3, label: '2–2.9' },
  { id: '1', min: 1, max: 2, label: '1–1.9' },
  { id: '0', min: 0, max: 1, label: '0–0.9' },
] as const;
export type RatingBandId = (typeof RATING_BANDS)[number]['id'];
export type RatingVisibility = Record<RatingBandId, number>;

/** Initial distance levels, in map resolution units (m/px): rating 10 matches the old medium tier. */
export const DEFAULT_RATING_VISIBILITY: RatingVisibility = {
  '10': 5,
  '9.9': 5.5,
  '9': 4.5,
  '8': 4,
  '7': 3.5,
  '6': 3,
  '5': 2.5,
  '4': 2,
  '3': 1.8,
  '2': 1.6,
  '1': 1.3,
  '0': 0.2,
};

export interface Visibility {
  /** `targetKey` of every hidden layer: `rent` / `sale` / `land` or a service discriminator. */
  hiddenLayers: ReadonlySet<string>;
  hiddenSections: ReadonlySet<SectionId>;
  ratingVisibility: RatingVisibility;
  /** A visitor without an account sees a listing's phone / WhatsApp (default: no — the server leaves them out). */
  visitorContact: boolean;
  /** Service layers whose providers may update their location. Property layers are always fixed. */
  providerMovableLayers: ReadonlySet<string>;
}

const SERVICE_KEYS = ALL_TARGETS.filter((t) => t.kind === 'service').map(targetKey);
const DEFAULT_MOVABLE_SERVICE_KEYS = SERVICE_KEYS.filter((key) => !(fixedLocationServices as string[]).includes(key));

export const ALL_VISIBLE: Visibility = {
  hiddenLayers: new Set(),
  hiddenSections: new Set(),
  ratingVisibility: DEFAULT_RATING_VISIBILITY,
  visitorContact: false,
  providerMovableLayers: new Set(DEFAULT_MOVABLE_SERVICE_KEYS),
};

const isSection = (v: unknown): v is SectionId => (SECTION_IDS as readonly unknown[]).includes(v);

/** Stored text → settings. Anything unreadable or unknown (a layer the map no longer has) is dropped, never fatal. */
export function parseVisibility(raw: string | null | undefined): Visibility {
  if (!raw) return ALL_VISIBLE;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return ALL_VISIBLE;
  }
  if (!data || typeof data !== 'object') return ALL_VISIBLE;
  const { hiddenLayers, hiddenSections, visitorContact, ratingVisibility, providerMovableLayers } = data as {
    hiddenLayers?: unknown;
    hiddenSections?: unknown;
    visitorContact?: unknown;
    ratingVisibility?: unknown;
    providerMovableLayers?: unknown;
  };
  const layers = Array.isArray(hiddenLayers) ? hiddenLayers.filter((k) => targetFromKey(k) !== null) : [];
  const sections = Array.isArray(hiddenSections) ? hiddenSections.filter(isSection) : [];
  return {
    hiddenLayers: new Set(layers as string[]),
    hiddenSections: new Set(sections),
    ratingVisibility: Object.fromEntries(
      RATING_BANDS.map(({ id }) => {
        const value = ratingVisibility && typeof ratingVisibility === 'object'
          ? Number((ratingVisibility as Record<string, unknown>)[id])
          : Number.NaN;
        return [id, Number.isFinite(value) && value >= 0.1 && value <= 20 ? value : DEFAULT_RATING_VISIBILITY[id]];
      }),
    ) as RatingVisibility,
    visitorContact: visitorContact === true,
    providerMovableLayers: new Set(
      (Array.isArray(providerMovableLayers) ? providerMovableLayers : DEFAULT_MOVABLE_SERVICE_KEYS)
        .filter((key): key is string => typeof key === 'string' && SERVICE_KEYS.includes(key)),
    ),
  };
}

/** Settings → stored text (sorted, so saving the same choice twice stores the same value). */
export function serializeVisibility(v: Visibility): string {
  return JSON.stringify({
    hiddenLayers: [...v.hiddenLayers].sort(),
    hiddenSections: [...v.hiddenSections].sort(),
    ratingVisibility: v.ratingVisibility,
    visitorContact: v.visitorContact,
    providerMovableLayers: [...v.providerMovableLayers].sort(),
  });
}

/** The "real estate only" preset: every service layer hidden, sections untouched. */
export function realEstateOnly(v: Visibility): Visibility {
  const services = ALL_TARGETS.filter((t) => t.kind === 'service').map(targetKey);
  return { ...v, hiddenLayers: new Set(services) };
}

export const isLayerShown = (v: Visibility, t: MapTarget | string) =>
  !v.hiddenLayers.has(typeof t === 'string' ? t : targetKey(t));

export const isSectionShown = (v: Visibility, id: SectionId) => !v.hiddenSections.has(id);

/** Pick the maximum resolution (farther out when larger) for a feature's manual rating. */
export function ratingMaxResolution(rating: unknown, levels: RatingVisibility): number {
  const value = typeof rating === 'number' || (typeof rating === 'string' && rating.trim() !== '')
    ? Number(rating)
    : Number.NaN;
  const safeRating = Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 1;
  const band = RATING_BANDS.find(({ min, max }) => safeRating >= min && safeRating <= max) ?? RATING_BANDS[6];
  return levels[band.id];
}

/** True only for an explicitly stored numeric zero; blank/missing ratings follow the rating-1 visibility fallback. */
export function isZeroRating(rating: unknown): boolean {
  if (typeof rating === 'number') return rating === 0;
  if (typeof rating !== 'string' || rating.trim() === '') return false;
  const value = Number(rating);
  return Number.isFinite(value) && value === 0;
}

/** Keys for `/api/platform-stats?excludedLayers=` (the server accepts the same `rent` / `sale` / `land` aliases). */
export const excludedLayersParam = (v: Visibility) =>
  v.hiddenLayers.size ? JSON.stringify([...v.hiddenLayers].sort()) : undefined;

/** Shows or hides a set of layers (a whole group, or one type). */
export function withLayers(v: Visibility, keys: readonly string[], shown: boolean): Visibility {
  const next = new Set(v.hiddenLayers);
  for (const k of keys) {
    if (shown) next.delete(k);
    else next.add(k);
  }
  return { ...v, hiddenLayers: next };
}

export function withSection(v: Visibility, id: SectionId, shown: boolean): Visibility {
  const next = new Set(v.hiddenSections);
  if (shown) next.delete(id);
  else next.add(id);
  return { ...v, hiddenSections: next };
}

/** Same choice (what the admin would save equals what is stored). */
export const sameVisibility = (a: Visibility, b: Visibility) =>
  serializeVisibility(a) === serializeVisibility(b);

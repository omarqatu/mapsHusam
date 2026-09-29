import { ALL_TARGETS, targetFromKey, targetKey, type MapTarget } from '@/features/map/targets';

// What the public sees: the admin hides layers (map types) and whole sections of the site. Stored on the server as one
// JSON value under `settings.visibility` (platform_content), applied by every page through `useVisibility`.
// Road status / fuel status have no switch of their own: they follow their layers (road_barriers, fuel_stations).

export const VISIBILITY_KEY = 'settings.visibility';

/** Parts of the site that are not a layer. */
export const SECTION_IDS = ['ticker', 'featured', 'stats', 'requests'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface Visibility {
  /** `targetKey` of every hidden layer: `rent` / `sale` / `land` or a service discriminator. */
  hiddenLayers: ReadonlySet<string>;
  hiddenSections: ReadonlySet<SectionId>;
}

export const ALL_VISIBLE: Visibility = { hiddenLayers: new Set(), hiddenSections: new Set() };

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
  const { hiddenLayers, hiddenSections } = data as { hiddenLayers?: unknown; hiddenSections?: unknown };
  const layers = Array.isArray(hiddenLayers) ? hiddenLayers.filter((k) => targetFromKey(k) !== null) : [];
  const sections = Array.isArray(hiddenSections) ? hiddenSections.filter(isSection) : [];
  return { hiddenLayers: new Set(layers as string[]), hiddenSections: new Set(sections) };
}

/** Settings → stored text (sorted, so saving the same choice twice stores the same value). */
export function serializeVisibility(v: Visibility): string {
  return JSON.stringify({
    hiddenLayers: [...v.hiddenLayers].sort(),
    hiddenSections: [...v.hiddenSections].sort(),
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

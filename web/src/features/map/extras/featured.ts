import type { Coordinate } from '../config';
import { collectMedia, type MediaItem, type Props } from '../popup/featureModel';
import { distanceToResult } from '../search/nearby';
import type { SearchResult } from '../search/results';
import { SERVICE_BY_KEY, TYPE_GROUP_IDS, type TypeGroupId } from '../registry';
import { ALL_TARGETS, hasPrice, isFuelStation, isRoadBarrier, targetKey, type MapTarget } from '../targets';

// Pure logic of the featured-services portal (legacy featured-services-portal.js), testable without React or a map.

/** One card: a feature plus, for the "top rated" section, the average of its real ratings. */
export interface FeaturedEntry {
  r: SearchResult;
  ratings?: { avg: number; total: number };
}

/** Which media a section's cards show. `all` = the listing's media as its provider set it up (pictures, before / after). */
export type FeaturedMode = 'all' | 'photo' | 'video';

/** A section shows at most this many cards (legacy). */
export const SECTION_LIMIT = 10;
/** The nearby list shows the closest this many features (legacy). */
export const NEARBY_LIMIT = 10;

/** Rating values that make a service "featured" / "recommended" (the `rating` column, compared as text by the server). */
export const FEATURED_RATING = '10';
export const RECOMMENDED_RATING = '9.9';

/**
 * The service layer and id whose real customer ratings a card shows instead of the hand-set `rating` column: every
 * service except road barriers and fuel stations (Husam, q1); `null` for property, those two, and rows without an id.
 */
export function customerRatingsKey(r: SearchResult): { layer: string; featureId: string } | null {
  if (r.target.kind !== 'service' || isRoadBarrier(r.target) || isFuelStation(r.target) || !r.id) return null;
  return { layer: r.target.discriminator, featureId: r.id };
}

/** The `rating` column is a hand-set score out of 10 (10 = featured); shown to visitors as stars out of 5. Customer ratings are already out of 5. */
export const manualStars = (rating: number) => Math.min(5, Math.max(0, rating / 2));

/**
 * The kinds that always get a card in a section when one is there: the three property kinds (rent, sale, land), then
 * the services priced like property (hotels, holiday villas). Legacy wanted them visible even when services with the
 * same rating fill the list (Husam, 30 September: "do not drop hotels and villas").
 */
const GUARANTEED_KINDS: readonly string[] = ALL_TARGETS.filter(hasPrice).map(targetKey);

/** Up to `limit` cards; the first card of each guaranteed kind comes first, then the rest in their order. */
export function pickForSection(items: FeaturedEntry[], limit = SECTION_LIMIT): FeaturedEntry[] {
  const guaranteed = GUARANTEED_KINDS.map((kind) => items.find((i) => targetKey(i.r.target) === kind)).filter(
    (i): i is FeaturedEntry => !!i,
  );
  const rest = items.filter((i) => !guaranteed.includes(i)).slice(0, Math.max(0, limit - guaranteed.length));
  return [...guaranteed, ...rest].slice(0, limit);
}

const isVideoItem = (m: MediaItem) => m.type === 'youtube' || m.type === 'video';

export const hasPhotos = (props: Props) => collectMedia(props).some((m) => m.type === 'image');
export const hasVideos = (props: Props) => collectMedia(props).some(isVideoItem);
/** The media a card of the photos / videos section displays. */
export function mediaForMode(props: Props, mode: FeaturedMode): MediaItem[] {
  const all = collectMedia(props);
  if (mode === 'photo') return all.filter((m) => m.type === 'image');
  if (mode === 'video') return all.filter(isVideoItem);
  return all;
}

// --- "near me" type filter (the type → group table is the `group` of each registry entry) ---------------
/** Legacy grouping of the type filter, from the registry; a discriminator the registry does not know lands in "misc". */
export function groupOf(target: MapTarget): TypeGroupId {
  if (target.kind === 'realEstate') return 'realestate';
  return SERVICE_BY_KEY.get(target.discriminator)?.group ?? 'misc';
}

/** Every type the map knows, by group, in the legacy group order; empty groups left out. */
export function groupedTargets(): { group: TypeGroupId; targets: MapTarget[] }[] {
  return TYPE_GROUP_IDS.map((group) => ({
    group,
    targets: ALL_TARGETS.filter((t) => groupOf(t) === group),
  })).filter((g) => g.targets.length > 0);
}

/** The closest `limit` features to `from`, nearest first, each carrying its `distance`. Empty `keys` = every type. */
export function nearestEntries(
  all: SearchResult[],
  from: Coordinate,
  keys: ReadonlySet<string>,
  limit = NEARBY_LIMIT,
): SearchResult[] {
  return all
    .filter((r) => keys.size === 0 || keys.has(targetKey(r.target)))
    .map((r) => ({ ...r, distance: distanceToResult(r, from) }))
    .filter((r) => Number.isFinite(r.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

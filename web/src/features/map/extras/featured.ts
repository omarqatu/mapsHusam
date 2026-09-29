import type { Coordinate } from '../config';
import { collectMedia, detailLinks, type MediaItem, type Props } from '../popup/featureModel';
import { distanceToResult } from '../search/nearby';
import type { SearchResult } from '../search/results';
import { SERVICE_BY_KEY, TYPE_GROUP_IDS, type TypeGroupId } from '../registry';
import { ALL_TARGETS, targetKey, type MapTarget } from '../targets';

// Pure logic of the featured-services portal (legacy featured-services-portal.js), testable without React or a map.

/** One card: a feature plus, for the "top rated" section, the average of its real ratings. */
export interface FeaturedEntry {
  r: SearchResult;
  ratings?: { avg: number; total: number };
}

/** Which media a section's cards show. `all` = every picture/video/link (legacy "featured" cards). */
export type FeaturedMode = 'all' | 'photo' | 'video' | 'beforeAfter';

/** A section shows at most this many cards (legacy). */
export const SECTION_LIMIT = 10;
/** The nearby list shows the closest this many features (legacy). */
export const NEARBY_LIMIT = 10;

/** Rating values that make a service "featured" / "recommended" (the `rating` column, compared as text by the server). */
export const FEATURED_RATING = '10';
export const RECOMMENDED_RATING = '9.9';

/**
 * Up to `limit` cards, but the first of each real-estate kind (rent, sale, land) is always in — legacy wanted the
 * property types visible even when services with the same rating fill the list.
 */
export function pickForSection(items: FeaturedEntry[], limit = SECTION_LIMIT): FeaturedEntry[] {
  const guaranteed = (['rent', 'sale', 'land'] as const)
    .map((layer) => items.find((i) => i.r.target.kind === 'realEstate' && i.r.target.layer === layer))
    .filter((i): i is FeaturedEntry => !!i);
  const rest = items.filter((i) => !guaranteed.includes(i)).slice(0, Math.max(0, limit - guaranteed.length));
  return [...guaranteed, ...rest].slice(0, limit);
}

const isVideoItem = (m: MediaItem) => m.type === 'youtube' || m.type === 'video';

export const hasPhotos = (props: Props) => collectMedia(props).some((m) => m.type === 'image');
export const hasVideos = (props: Props) => collectMedia(props).some(isVideoItem);
/** Both "details" links present (legacy: before / after). */
export const hasBeforeAfter = (props: Props) => detailLinks(props).every((u) => u !== null);

/** The media a card of this section displays (`beforeAfter` cards use `detailLinks` instead). */
export function mediaForMode(props: Props, mode: FeaturedMode): MediaItem[] {
  const all = collectMedia(props);
  if (mode === 'photo') return all.filter((m) => m.type === 'image');
  if (mode === 'video') return all.filter(isVideoItem);
  return all;
}

/** One before/after side as media: an image, a YouTube/video file, or a link. */
export function sideMedia(url: string | null, linkLabelKey: string): MediaItem[] {
  if (!url) return [];
  const [m] = collectMedia({ details_link_1: url });
  return m ? [m.type === 'link' ? { ...m, labelKey: linkLabelKey } : m] : [];
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

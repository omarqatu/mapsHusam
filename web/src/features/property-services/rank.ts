import { availability, text, type Props } from '../map/popup/featureModel';
import type { Coordinate } from '../map/config';
import { distanceToResult } from '../map/search/nearby';
import type { SearchResult } from '../map/search/results';

// Which providers a property card shows first. The nearest is not the best, so distance is the LAST tie-break:
//   1. in the property's area   (same governorate — the data has no "service area", this is the closest honest proxy)
//   2. available now            (not closed, unavailable or withdrawn)
//   3. rating people can trust  (real ratings from completed requests, pulled toward a neutral mean when there are few)
//   4. distance                 (breaks ties)
// There is no "verified" step: nothing in the data says who checked a licence, and a made-up badge is worse than none.

export interface RatingSummary {
  avg: number;
  count: number;
}

/** Where the property is: the governorate decides "in the area" (empty when the row has none). */
export interface PropertyPlace {
  gov: string;
}

export interface RankedProvider {
  r: SearchResult;
  /** Metres from the property. */
  distance: number;
  rating: RatingSummary | null;
  inArea: boolean;
  available: boolean;
}

/** A provider with few ratings is judged as if it also had PRIOR_WEIGHT ratings of PRIOR_MEAN (5.0 from one customer must not beat 4.7 from forty). */
export const PRIOR_MEAN = 3.5;
export const PRIOR_WEIGHT = 3;

export const trustedRating = (s: RatingSummary | null) =>
  s ? (s.avg * s.count + PRIOR_MEAN * PRIOR_WEIGHT) / (s.count + PRIOR_WEIGHT) : PRIOR_MEAN;

const sameName = (a: unknown, b: string) => text(a).replace(/\s+/g, ' ') === b.replace(/\s+/g, ' ');

export const isAvailable = (props: Props) => {
  const state = availability(props);
  return state === null || state === 'open';
};

/** Every provider, best first. `ratings` is keyed by the provider's feature id. */
export function rankProviders(
  candidates: SearchResult[],
  origin: Coordinate,
  place: PropertyPlace,
  ratings: ReadonlyMap<string, RatingSummary>,
): RankedProvider[] {
  return candidates
    .map((r) => ({
      r,
      distance: distanceToResult(r, origin),
      rating: (r.id ? ratings.get(r.id) : undefined) ?? null,
      inArea: !!place.gov && sameName(r.props.gov_a, place.gov),
      available: isAvailable(r.props),
    }))
    .filter((p) => Number.isFinite(p.distance))
    .sort(
      (a, b) =>
        Number(b.inArea) - Number(a.inArea) ||
        Number(b.available) - Number(a.available) ||
        trustedRating(b.rating) - trustedRating(a.rating) ||
        a.distance - b.distance,
    );
}

import type { Coordinate } from '../map/config';
import { availability, type Availability } from '../map/popup/featureModel';
import { distanceToResult } from '../map/search/nearby';
import type { SearchResult } from '../map/search/results';

// Which providers a property card shows first. Candidates are already near the property (the search starts around its
// point and widens only when there are few), so inside them:
//   1. active              (not "unavailable for now" / withdrawn by its owner)
//   2. trusted rating      (real ratings from completed requests, pulled toward a neutral mean when there are few,
//                           with a LIGHT penalty for being closed right now)
//   3. distance            (breaks ties)
// The governorate is context (it fills in when the radius finds nobody), never a factor that wins: a surveyor 3 km away
// across a governorate line beats one 35 km away inside it. A surveyor is not a restaurant: closed at 8 pm says little
// about the work, so "closed now" costs one rating band, no more. There is no "verified" step: nothing in the data says
// who checked a licence, and a made-up badge is worse than none.

export interface RatingSummary {
  avg: number;
  count: number;
}

export interface RankedProvider {
  r: SearchResult;
  /** Metres from the property. */
  distance: number;
  rating: RatingSummary | null;
  /** Not "unavailable for now" and not withdrawn. */
  active: boolean;
  state: Availability | null;
}

/** A provider with few ratings is judged as if it also had PRIOR_WEIGHT ratings of PRIOR_MEAN (5.0 from one customer must not beat 4.7 from forty). */
export const PRIOR_MEAN = 3.5;
export const PRIOR_WEIGHT = 3;
/** Ratings closer than this count as equal (4.55 vs 4.60 is noise), so the nearer one wins instead of a false precision. */
export const BAND = 0.25;
/** Being closed right now costs one band: a light nudge, not a verdict. */
export const CLOSED_PENALTY = BAND;

export const trustedRating = (s: RatingSummary | null) =>
  s ? (s.avg * s.count + PRIOR_MEAN * PRIOR_WEIGHT) / (s.count + PRIOR_WEIGHT) : PRIOR_MEAN;

/** The rating step a provider sits on (higher is better); equal steps are decided by distance. */
export const ratingBand = (rating: RatingSummary | null, state: Availability | null) =>
  Math.round((trustedRating(rating) - (state === 'closed' ? CLOSED_PENALTY : 0)) / BAND);

export const isActive = (state: Availability | null) => state !== 'unavailable' && state !== 'withdrawn';

/** Every provider, best first. `ratings` is keyed by the provider's feature id. */
export function rankProviders(
  candidates: SearchResult[],
  origin: Coordinate,
  ratings: ReadonlyMap<string, RatingSummary>,
): RankedProvider[] {
  return candidates
    .map((r) => {
      const state = availability(r.props);
      return {
        r,
        distance: distanceToResult(r, origin),
        rating: (r.id ? ratings.get(r.id) : undefined) ?? null,
        active: isActive(state),
        state,
      };
    })
    .filter((p) => Number.isFinite(p.distance))
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        ratingBand(b.rating, b.state) - ratingBand(a.rating, a.state) ||
        a.distance - b.distance,
    );
}

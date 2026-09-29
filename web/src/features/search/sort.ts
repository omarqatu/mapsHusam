import type { Coordinate } from '../map/config';
import { distanceToResult } from '../map/search/nearby';
import { byRatingDesc, type SearchResult } from '../map/search/results';

export type SortMode = 'rating' | 'name' | 'nearest' | 'priceAsc' | 'priceDesc';

const nameOf = (r: SearchResult) => String(r.props.name ?? r.props.location ?? r.props.location_name ?? '');
const priceOf = (r: SearchResult) => {
  const n = Number(r.props.price);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * A new, sorted list. `rating` (highest first) is what legacy did; `nearest` needs `from` and adds `distance` to every row;
 * price sorts put rows without a price last (they only make sense with one currency, the page offers them then).
 */
export function sortResults(items: SearchResult[], mode: SortMode, from?: Coordinate | null): SearchResult[] {
  if (mode === 'nearest') {
    if (!from) return [...items].sort(byRatingDesc);
    return items
      .map((r) => ({ ...r, distance: distanceToResult(r, from) }))
      .sort((a, b) => a.distance - b.distance);
  }
  const list = [...items];
  if (mode === 'name') return list.sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ar'));
  if (mode === 'priceAsc' || mode === 'priceDesc') {
    const dir = mode === 'priceAsc' ? 1 : -1;
    return list.sort((a, b) => {
      const pa = priceOf(a);
      const pb = priceOf(b);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return (pa - pb) * dir;
    });
  }
  return list.sort(byRatingDesc);
}

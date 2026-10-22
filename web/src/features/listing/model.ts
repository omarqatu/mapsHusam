import type { Props } from '../map/popup/featureModel';
import { distanceToResult } from '../map/search/nearby';
import type { SearchResult } from '../map/search/results';

/** Price per square metre, when both are known (a land's or a flat's most compared number). */
export function pricePerMeter(props: Props): number | null {
  const price = Number(props.price);
  const area = Number(props.area);
  return Number.isFinite(price) && Number.isFinite(area) && price > 0 && area > 0 ? Math.round(price / area) : null;
}

export const SIMILAR_COUNT = 10;

/** The closest listings of the same type, the listing itself left out, each with its distance. */
export function closestOthers(rows: SearchResult[], of: SearchResult, count = SIMILAR_COUNT): SearchResult[] {
  return rows
    .filter((r) => r.key !== of.key)
    .map((r) => ({ r, d: distanceToResult(r, of.center) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ r, d }) => ({ ...r, distance: d }));
}

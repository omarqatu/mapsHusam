import type { SearchCondition } from '@/api/search';
import { decodeShareState, encodeShareState } from '../map/search/shareLink';
import { targetFromKey, targetKey, type MapTarget } from '../map/targets';

// What the page shows is described by its URL: `?group=`, `?q=` (keyword box) and the chosen type with its filters.
// A type without filters is `?type=<key>`; with filters it is `?resultsShare=` — the map's own "results link" format
// (`attribute` kind), so the same link also opens on the map, and a link copied from the map opens here.

export interface Selection {
  target: MapTarget;
  conditions: SearchCondition[];
}

export function readSelection(params: URLSearchParams): Selection | null {
  const shared = decodeShareState(params.get('resultsShare'));
  if (shared?.type === 'attribute') {
    const target = targetFromKey(shared.target);
    if (target) return { target, conditions: shared.conditions };
  }
  const target = targetFromKey(params.get('type'));
  return target ? { target, conditions: [] } : null;
}

/** Sets or clears the selection params on a copy of `params` (other params — group, q — are kept). */
export function writeSelection(params: URLSearchParams, selection: Selection | null): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('type');
  next.delete('resultsShare');
  if (!selection) return next;
  if (selection.conditions.length === 0) next.set('type', targetKey(selection.target));
  else
    next.set(
      'resultsShare',
      encodeShareState({
        type: 'attribute',
        target: targetKey(selection.target),
        conditions: selection.conditions,
      }),
    );
  return next;
}

/** The map's link for the same search (attribute results link), or the plain map for a search without filters. */
export function mapSearchPath(selection: Selection): string {
  return `/?resultsShare=${encodeShareState({
    type: 'attribute',
    target: targetKey(selection.target),
    conditions: selection.conditions,
  })}`;
}

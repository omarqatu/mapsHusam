import { useMemo } from 'react';
import { useCategoryCounts } from '@/api/platform';
import { useLayerFilter } from '@/features/visibility/store';
import { ALL_TARGETS, targetFromKey, targetToApi, type MapTarget } from '../map/targets';

/** Shown until the listing counts arrive (or if they never do). */
const FALLBACK_POPULAR = ['rent', 'sale', 'plumber', 'electrician', 'ac_technician'] as const;
/** Status lists, not something people browse for: never among the popular types. */
const NOT_POPULAR = new Set(['road_barriers', 'fuel_stations']);
const POPULAR_SERVICES = 3;

/** Rent and sale first, then the service types with the most listings right now — only types this viewer may see. */
export function usePopularTargets(): MapTarget[] {
  const layerShown = useLayerFilter();
  const counts = useCategoryCounts().data;
  return useMemo(() => {
    const fixed = FALLBACK_POPULAR.slice(0, 2).map((k) => targetFromKey(k));
    const services = counts
      ? ALL_TARGETS.filter((x) => x.kind === 'service' && !NOT_POPULAR.has(x.discriminator) && layerShown(x))
          .map((x) => ({ x, n: counts[targetToApi(x).layer] ?? 0 }))
          .filter(({ n }) => n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, POPULAR_SERVICES)
          .map(({ x }) => x)
      : FALLBACK_POPULAR.slice(2).map((k) => targetFromKey(k));
    return [...fixed, ...services].filter((x): x is MapTarget => !!x && layerShown(x));
  }, [counts, layerShown]);
}

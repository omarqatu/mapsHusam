import { useMemo } from 'react';
import { useLayerFilter, useSectionShown } from '@/features/visibility/store';
import { EXTRAS_TABS, type ExtrasTab } from './store';

/** The extras tabs this viewer may see: road / fuel status follow their layers, featured and stats their own switch. */
export function useShownExtrasTabs(): ExtrasTab[] {
  const layerShown = useLayerFilter();
  const featured = useSectionShown('featured');
  const stats = useSectionShown('stats');
  return useMemo(
    () =>
      EXTRAS_TABS.filter((id) => {
        if (id === 'featured') return featured;
        if (id === 'stats') return stats;
        return layerShown(id === 'roads' ? 'road_barriers' : 'fuel_stations');
      }),
    [layerShown, featured, stats],
  );
}

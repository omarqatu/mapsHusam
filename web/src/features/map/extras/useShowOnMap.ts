import { useCallback } from 'react';
import { useOlMap } from '../MapContext';
import { logMapClick } from '../popup/logMapClick';
import { toSelected, type SearchResult } from '../search/results';
import { useMapUi } from '../store';

/** "Show on map": fly to the feature and open its details card (legacy "go to map" button; logged as a map click). */
export function useShowOnMap() {
  const map = useOlMap();
  return useCallback(
    (r: SearchResult) => {
      map?.getView().animate({ center: r.center, zoom: 19, duration: 800 });
      const selected = toSelected(r);
      useMapUi.getState().setSelected(selected);
      logMapClick(selected);
    },
    [map],
  );
}

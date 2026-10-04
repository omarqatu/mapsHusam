import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useOlMap } from '../MapContext';
import { logMapClick } from '../popup/logMapClick';
import { toSelected, type SearchResult } from '../search/results';
import { useMapUi } from '../store';
import { mapLinkTo } from '../mapLink';

/**
 * "Show on map": fly to the feature and open its details card (legacy "go to map" button; logged as a map click).
 * From another page (the search page) the card is selected first, then the map opens at the feature through the
 * `?x=&y=` link — the map keeps the selection, so it opens with the card instead of a bare point.
 */
export function useShowOnMap() {
  const map = useOlMap();
  const navigate = useNavigate();
  const onMapPage = useLocation().pathname === '/';
  return useCallback(
    (r: SearchResult) => {
      const selected = toSelected(r);
      useMapUi.getState().setSelected(selected);
      logMapClick(selected);
      if (!onMapPage) {
        void navigate(mapLinkTo(r.center));
        return;
      }
      map?.getView().animate({ center: r.center, zoom: 19, duration: 800 });
    },
    [map, navigate, onMapPage],
  );
}

import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useOlMap } from '../MapContext';
import { logMapClick } from '../popup/logMapClick';
import { toSelected, type SearchResult } from '../search/results';
import { useMapUi } from '../store';
import { mapLinkTo } from '../mapLink';

/**
 * "Show on map": on the map page fly to the feature and open its details card (legacy "go to map" button; logged as a
 * map click). Anywhere else (the search page) open the map at that feature through the `?x=&y=` link.
 */
export function useShowOnMap() {
  const map = useOlMap();
  const navigate = useNavigate();
  const onMapPage = useLocation().pathname === '/';
  return useCallback(
    (r: SearchResult) => {
      if (!onMapPage) {
        void navigate(mapLinkTo(r.center));
        return;
      }
      map?.getView().animate({ center: r.center, zoom: 19, duration: 800 });
      const selected = toSelected(r);
      useMapUi.getState().setSelected(selected);
      logMapClick(selected);
    },
    [map, navigate, onMapPage],
  );
}

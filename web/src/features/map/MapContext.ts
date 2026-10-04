import { createContext, useContext } from 'react';
import type OlMap from 'ol/Map';

export const MapContext = createContext<OlMap | null>(null);

/** The single OpenLayers map instance; `null` until MapView has mounted it. */
export function useOlMap() {
  return useContext(MapContext);
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import OlMap from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls } from 'ol/control/defaults';
import type BaseLayer from 'ol/layer/Base';
import type VectorLayer from 'ol/layer/Vector';
import 'ol/ol.css';
import { useTranslation } from 'react-i18next';
import i18nInstance from '@/i18n';
import { toast } from '@/components/ui/toastStore';
import {
  BASEMAPS,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  REAL_ESTATE_LAYERS,
  REFRESH_INTERVAL_MS,
  SERVICE_ALL_LAYER,
} from './config';
import { readSharedCenter } from './mapUtils';
import { createBasemaps, createWfsLayer } from './layers';
import { MapContext } from './MapContext';
import { palestineGrid } from './projection';
import { useMapUi } from './store';
import { realEstateStyle, serviceStyle, type Translate } from './styles';

/**
 * Owns the one OpenLayers map. Children (controls, panels) get it through `useOlMap()` and render only once
 * the map exists. Layer visibility follows the Zustand map store.
 */
export default function MapView({ children }: { children?: ReactNode }) {
  const { i18n } = useTranslation();
  const target = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<OlMap | null>(null);

  useEffect(() => {
    // Style functions are created once; they read the current language through the i18n instance.
    const translate: Translate = (k) => i18nInstance.t(k);
    const basemaps = createBasemaps();
    const reportError = () => toast.error(i18nInstance.t('map.layerLoadFailed'));
    let errorShown = false;
    const onLayerError = () => {
      if (!errorShown) reportError();
      errorShown = true;
    };

    const realEstate = REAL_ESTATE_LAYERS.map((def) =>
      createWfsLayer(def, realEstateStyle(def.key, translate), onLayerError),
    );
    const services = createWfsLayer(
      SERVICE_ALL_LAYER,
      serviceStyle({ t: translate, isHidden: (d) => useMapUi.getState().hiddenServices.has(d) }),
      onLayerError,
    );

    const baseLayers = BASEMAPS.map((k) => basemaps[k]).filter((l): l is BaseLayer => l !== null);
    const shared = readSharedCenter(window.location.search);
    const olMap = new OlMap({
      target: target.current!,
      layers: [...baseLayers, ...realEstate, services],
      controls: defaultControls({ zoom: false, rotate: false }),
      view: new View({
        projection: palestineGrid,
        center: shared ?? DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        constrainResolution: true,
        enableRotation: false,
      }),
      pixelRatio: Math.min(window.devicePixelRatio, 2),
    });

    // --- follow the store ---
    const applyUi = (s = useMapUi.getState()) => {
      BASEMAPS.forEach((k) => basemaps[k]?.setVisible(k === s.basemap));
      realEstate.forEach((l, i) => l.setVisible(s.realEstateVisible[REAL_ESTATE_LAYERS[i].key]));
      services.changed(); // hidden service types are applied inside the style function
    };
    applyUi();
    const unsubscribe = useMapUi.subscribe((s, prev) => {
      if (
        s.basemap !== prev.basemap ||
        s.realEstateVisible !== prev.realEstateVisible ||
        s.hiddenServices !== prev.hiddenServices
      )
        applyUi(s);
    });

    // Legacy refreshed visible data layers every minute (road barrier / fuel status change live).
    const dataLayers: VectorLayer[] = [...realEstate, services];
    const refresh = window.setInterval(() => {
      dataLayers.forEach((l) => l.getVisible() && l.getSource()?.refresh());
    }, REFRESH_INTERVAL_MS);

    // The container changes size (mobile toolbar, panels, rotation) — keep the canvas in sync.
    const resize = new ResizeObserver(() => olMap.updateSize());
    resize.observe(target.current!);

    olMap.set('dataLayers', dataLayers);
    setMap(olMap);
    return () => {
      unsubscribe();
      window.clearInterval(refresh);
      resize.disconnect();
      olMap.setTarget(undefined);
      olMap.dispose();
      setMap(null);
    };
  }, []);

  // Labels are translated inside style functions; redraw when the language changes.
  useEffect(() => {
    if (!map) return;
    (map.get('dataLayers') as VectorLayer[] | undefined)?.forEach((l) => l.changed());
  }, [map, i18n.language]);

  return (
    <MapContext value={map}>
      <div ref={target} className="absolute inset-0" data-testid="map" />
      {map && children}
    </MapContext>
  );
}

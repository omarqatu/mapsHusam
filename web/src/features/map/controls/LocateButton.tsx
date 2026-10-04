import { useEffect, useRef, useState } from 'react';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import { Crosshair, LocateFixed, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui/toastStore';
import { GPS_MIN_INTERVAL_MS } from '../config';
import { useOlMap } from '../MapContext';
import { geolocationErrorKey } from '../mapUtils';
import { fromLonLat } from '../projection';
import MapButton from './MapButton';

type State = 'off' | 'waiting' | 'tracking';

/** Toggle live GPS tracking: blue dot + follow (legacy 🎯 button). */
export default function LocateButton({ autoStart = false }: { autoStart?: boolean }) {
  const { t } = useTranslation();
  const map = useOlMap();
  const [state, setState] = useState<State>('off');
  const watchId = useRef<number | null>(null);
  const layer = useRef<VectorLayer | null>(null);

  useEffect(() => {
    if (!map) return;
    const l = new VectorLayer({
      source: new VectorSource(),
      zIndex: 2001,
      style: new Style({
        image: new Circle({
          radius: 9,
          fill: new Fill({ color: '#3399CC' }),
          stroke: new Stroke({ color: '#fff', width: 3 }),
        }),
      }),
    });
    map.addLayer(l);
    layer.current = l;
    return () => {
      map.removeLayer(l);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [map]);

  const stop = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    layer.current?.getSource()?.clear();
    setState('off');
  };

  const start = () => {
    const secure = window.isSecureContext;
    if (!('geolocation' in navigator) || !secure) {
      toast.error(t(geolocationErrorKey(2, secure)));
      return;
    }
    setState('waiting');
    let last = 0;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - last < GPS_MIN_INTERVAL_MS) return;
        last = now;
        const coord = fromLonLat(pos.coords.longitude, pos.coords.latitude);
        const source = layer.current?.getSource();
        source?.clear();
        source?.addFeature(new Feature(new Point(coord)));
        const view = map?.getView();
        const z = view?.getZoom() ?? 0;
        view?.animate({ center: coord, zoom: z < 17 ? 18 : z, duration: 500 });
        setState('tracking');
      },
      (err) => {
        stop();
        toast.error(t(geolocationErrorKey(err.code, true)));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  // "Open at my location" from the start screen.
  const started = useRef(false);
  useEffect(() => {
    if (autoStart && map && !started.current) {
      started.current = true;
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when the map is ready
  }, [autoStart, map]);

  return (
    <MapButton
      label={state === 'off' ? t('map.locate') : t('map.stopLocate')}
      active={state !== 'off'}
      onClick={state === 'off' ? start : stop}
    >
      {state === 'waiting' ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : state === 'tracking' ? (
        <LocateFixed className="h-5 w-5" />
      ) : (
        <Crosshair className="h-5 w-5" />
      )}
    </MapButton>
  );
}

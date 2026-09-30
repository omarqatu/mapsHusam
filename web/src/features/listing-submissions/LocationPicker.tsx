import { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Feature from 'ol/Feature';
import OlMap from 'ol/Map';
import View from 'ol/View';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import Button from '@/components/ui/Button';
import { toast } from '@/components/ui/toastStore';
import { DEFAULT_CENTER, type Coordinate } from '@/features/map/config';
import { GeoError, locateOnce } from '@/features/map/geolocate';
import { createBasemaps } from '@/features/map/layers';
import { palestineGrid } from '@/features/map/projection';

const MARKER = new Style({
  image: new CircleStyle({
    radius: 9,
    fill: new Fill({ color: '#4f46e5' }),
    stroke: new Stroke({ color: '#ffffff', width: 3 }),
  }),
});

/**
 * A small map to tap the business location on (the server takes it as Palestine Grid metres). Tap again to move the
 * pin; "my location" uses the GPS. Uncontrolled by the URL: the parent owns the point.
 */
export default function LocationPicker({
  value,
  onChange,
  invalid,
}: {
  value: Coordinate | null;
  onChange: (point: Coordinate) => void;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const target = useRef<HTMLDivElement>(null);
  const marker = useRef(new Feature<Point>());
  const mapRef = useRef<OlMap | null>(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const basemap = createBasemaps().esri!;
    const pin = new VectorLayer({
      source: new VectorSource({ features: [marker.current] }),
      style: MARKER,
      zIndex: 5,
    });
    const map = new OlMap({
      target: target.current!,
      layers: [basemap, pin],
      controls: [],
      view: new View({
        projection: palestineGrid,
        center: DEFAULT_CENTER,
        zoom: 17,
        maxZoom: 21,
        constrainResolution: true,
        enableRotation: false,
      }),
    });
    map.on('singleclick', (e) => onChangeRef.current([e.coordinate[0], e.coordinate[1]]));
    mapRef.current = map;
    return () => {
      map.setTarget(undefined);
      map.dispose();
      mapRef.current = null;
    };
  }, []);

  // Follow the chosen point: pin it and bring it into view.
  useEffect(() => {
    marker.current.setGeometry(value ? new Point(value) : undefined);
    if (value) mapRef.current?.getView().animate({ center: value, duration: 200 });
  }, [value]);

  async function useMyLocation() {
    setLocating(true);
    try {
      const point = await locateOnce();
      onChange(point);
      mapRef.current?.getView().setZoom(18);
    } catch (e) {
      toast.error(t(e instanceof GeoError ? e.messageKey : 'map.gps.unavailable'));
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={target}
        role="application"
        aria-label={t('submit.map.label')}
        className={`h-72 w-full overflow-hidden rounded-xl border sm:h-96 ${invalid ? 'border-danger-solid' : 'border-line-strong'}`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t(value ? 'submit.map.picked' : 'submit.map.hint')}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={locating}
          startIcon={<LocateFixed className="h-4 w-4" aria-hidden />}
          onClick={useMyLocation}
        >
          {t('submit.map.myLocation')}
        </Button>
      </div>
    </div>
  );
}

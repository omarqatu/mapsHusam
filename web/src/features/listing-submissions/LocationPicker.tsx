import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { LocateFixed, MapPin, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import OlMap from 'ol/Map';
import View from 'ol/View';
import Button from '@/components/ui/Button';
import { toast } from '@/components/ui/toastStore';
import { DEFAULT_CENTER, type Coordinate } from '@/features/map/config';
import { GeoError, locateOnce } from '@/features/map/geolocate';
import { createBasemaps } from '@/features/map/layers';
import { palestineGrid } from '@/features/map/projection';

/**
 * Where a listing is: the pin stays in the middle and the map moves under it (drag, or tap a spot to bring it to the
 * pin); "my location" uses the GPS, and runs by itself when there is no point yet. Satellite imagery, so a house or a
 * shop can be told apart. Palestine Grid metres out; the parent owns the point.
 */
export default function LocationPicker({
  value,
  onChange,
  invalid,
  tall,
}: {
  value: Coordinate | null;
  onChange: (point: Coordinate) => void;
  invalid?: boolean;
  /** Most of the screen (the add flow's location step). */
  tall?: boolean;
}) {
  const { t } = useTranslation();
  const target = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const onChangeRef = useRef(onChange);
  const startValue = useRef(value);
  const [locating, setLocating] = useState(false);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const view = new View({
      projection: palestineGrid,
      center: startValue.current ?? DEFAULT_CENTER,
      zoom: startValue.current ? 18 : 15,
      maxZoom: 21,
      constrainResolution: true,
      enableRotation: false,
    });
    const map = new OlMap({ target: target.current!, layers: [createBasemaps().esri!], controls: [], view });
    // Only a move the person made picks the point (not the first view, nor a GPS jump they did not ask for).
    let touched = false;
    map.on('pointerdrag', () => {
      touched = true;
      setMoving(true);
    });
    map.on('singleclick', (e) => {
      touched = true;
      view.animate({ center: e.coordinate, duration: 250 });
    });
    map.on('moveend', () => {
      setMoving(false);
      const c = view.getCenter();
      if (touched && c) onChangeRef.current([c[0], c[1]]);
    });
    mapRef.current = map;
    return () => {
      map.setTarget(undefined);
      map.dispose();
      mapRef.current = null;
    };
  }, []);

  // A point set from outside (GPS, a reset) is brought under the pin.
  useEffect(() => {
    const view = mapRef.current?.getView();
    const c = view?.getCenter();
    if (view && value && (!c || Math.hypot(c[0] - value[0], c[1] - value[1]) > 0.5)) {
      view.animate({ center: value, duration: 250 });
    }
  }, [value]);

  async function locate(quiet = false) {
    setLocating(true);
    try {
      const point = await locateOnce();
      mapRef.current?.getView().animate({ center: point, zoom: 18, duration: 300 });
      onChangeRef.current(point);
    } catch (e) {
      if (!quiet) toast.error(t(e instanceof GeoError ? e.messageKey : 'map.gps.unavailable'));
    } finally {
      setLocating(false);
    }
  }

  // No point yet: start where the person is (silently: a refused permission just leaves the default view).
  useEffect(() => {
    if (!startValue.current) void locate(true);
    // once, on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoom = (d: number) => {
    const view = mapRef.current?.getView();
    view?.animate({ zoom: (view.getZoom() ?? 15) + d, duration: 200 });
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className={clsx(
          'relative w-full overflow-hidden rounded-xl border',
          tall ? 'h-[60dvh] min-h-80' : 'h-72 sm:h-96',
          invalid ? 'border-danger-solid' : 'border-line-strong',
        )}
      >
        <div
          ref={target}
          role="application"
          aria-label={t('submit.map.label')}
          className="absolute inset-0"
        />
        {/* The pin: its tip is the point. Lifted while the map moves. */}
        <MapPin
          aria-hidden
          className={clsx(
            'pointer-events-none absolute start-1/2 top-1/2 h-11 w-11 -translate-y-full fill-brand text-white drop-shadow-lg transition-transform rtl:translate-x-1/2 ltr:-translate-x-1/2',
            moving && '-translate-y-[115%]',
          )}
          strokeWidth={1.5}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute start-1/2 top-1/2 h-1.5 w-3 -translate-y-1/2 rounded-full bg-black/40 rtl:translate-x-1/2 ltr:-translate-x-1/2"
        />
        <div className="absolute end-2 top-2 flex flex-col overflow-hidden rounded-lg bg-surface/95 shadow">
          <button
            type="button"
            aria-label={t('map.zoomIn')}
            className="p-2 text-fg hover:bg-subtle"
            onClick={() => zoom(1)}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t('map.zoomOut')}
            className="border-t border-line p-2 text-fg hover:bg-subtle"
            onClick={() => zoom(-1)}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="absolute inset-x-2 bottom-2 flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shadow"
            loading={locating}
            startIcon={<LocateFixed className="h-4 w-4" aria-hidden />}
            onClick={() => void locate()}
          >
            {t('submit.map.myLocation')}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted">{t(value ? 'submit.map.picked' : 'submit.map.hint')}</p>
    </div>
  );
}

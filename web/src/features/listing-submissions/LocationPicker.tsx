import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronDown, LocateFixed, MapPin, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import OlMap from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style } from 'ol/style';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import SelectInput from '@/components/ui/SelectInput';
import { toast } from '@/components/ui/toastStore';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { DEFAULT_CENTER, type Coordinate } from '@/features/map/config';
import { GeoError, locateOnce } from '@/features/map/geolocate';
import { createBasemaps } from '@/features/map/layers';
import { palestineGrid } from '@/features/map/projection';
import { fetchRegions, matchingRegions, regionValues, regionsExtent } from './regionPicker';
import { isLatestLocationIntent } from './locationIntent';
import type { RegionField } from './regionPicker';

const REGION_STYLE = new Style({
  stroke: new Stroke({ color: '#6d28d9', width: 2.5 }),
  fill: new Fill({ color: 'rgba(109, 40, 217, 0.12)' }),
});

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
  onChange: (point: Coordinate | null) => void;
  invalid?: boolean;
  /** Most of the screen (the add flow's location step). */
  tall?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const isDesktop = useIsDesktop();
  const target = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const regionSourceRef = useRef<VectorSource | null>(null);
  const onChangeRef = useRef(onChange);
  const startValue = useRef(value);
  const locationIntentRef = useRef(0);
  const [locating, setLocating] = useState(false);
  const [moving, setMoving] = useState(false);
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [locality, setLocality] = useState('');
  const movedByUserRef = useRef(false);
  const regionsQuery = useQuery({
    queryKey: ['listing-location-regions'],
    queryFn: ({ signal }) => fetchRegions(signal),
    staleTime: 60 * 60_000,
    retry: false,
  });

  const regions = useMemo(() => regionsQuery.data ?? [], [regionsQuery.data]);
  const cities = useMemo(() => regionValues(regions, 'gov_a', {}, i18n.language), [regions, i18n.language]);
  const areaOptions = useMemo(
    () => regionValues(regions, 'village_a', { gov_a: city }, i18n.language),
    [regions, city, i18n.language],
  );
  const localities = useMemo(
    () => regionValues(regions, 'location', { gov_a: city, village_a: region }, i18n.language),
    [regions, city, region, i18n.language],
  );

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
    const regionSource = new VectorSource();
    const regionLayer = new VectorLayer({ source: regionSource, style: REGION_STYLE });
    regionLayer.set('key', 'listing-location-region');
    const map = new OlMap({
      target: target.current!,
      layers: [createBasemaps().esri!, regionLayer],
      controls: [],
      view,
    });
    // Only a move the person made picks the point (not the first view, nor a GPS jump they did not ask for).
    map.on('pointerdrag', () => {
      locationIntentRef.current += 1;
      movedByUserRef.current = true;
      setMoving(true);
    });
    map.on('singleclick', (e) => {
      locationIntentRef.current += 1;
      movedByUserRef.current = true;
      view.animate({ center: e.coordinate, duration: 250 });
    });
    map.on('moveend', () => {
      setMoving(false);
      const c = view.getCenter();
      if (movedByUserRef.current && c) onChangeRef.current([c[0], c[1]]);
      movedByUserRef.current = false;
    });
    mapRef.current = map;
    regionSourceRef.current = regionSource;
    return () => {
      map.setTarget(undefined);
      map.dispose();
      mapRef.current = null;
      regionSourceRef.current = null;
    };
  }, []);

  // A point set from outside (GPS, a reset) is brought under the pin.
  useEffect(() => {
    const view = mapRef.current?.getView();
    const c = view?.getCenter();
    if (view && value && (!c || Math.hypot(c[0] - value[0], c[1] - value[1]) > 0.5)) {
      movedByUserRef.current = false;
      view.animate({ center: value, duration: 250 });
    }
  }, [value]);

  async function locate(quiet = false) {
    const intent = quiet ? locationIntentRef.current : ++locationIntentRef.current;
    setLocating(true);
    try {
      const point = await locateOnce();
      if (!isLatestLocationIntent(intent, locationIntentRef.current)) return;
      movedByUserRef.current = false;
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

  function focusRegion(field: RegionField, value: string) {
    locationIntentRef.current += 1;
    const filters =
      field === 'gov_a'
        ? { gov_a: value }
        : field === 'village_a'
          ? { gov_a: city, village_a: value }
          : { gov_a: city, village_a: region, location: value };
    const selected = matchingRegions(regions, filters);
    const extent = regionsExtent(selected);
    if (!extent) return;

    onChangeRef.current(null);
    movedByUserRef.current = false;
    const source = regionSourceRef.current;
    source?.clear();
    source?.addFeatures(selected);
    mapRef.current?.getView().fit(extent, {
      duration: 450,
      maxZoom: field === 'gov_a' ? 11 : field === 'village_a' ? 14 : 17,
      padding: [36, 36, 36, 36],
    });
  }

  function chooseCity(value: string) {
    setCity(value);
    setRegion('');
    setLocality('');
    if (value) focusRegion('gov_a', value);
  }

  function chooseRegion(value: string) {
    setRegion(value);
    setLocality('');
    if (value) focusRegion('village_a', value);
  }

  function chooseLocality(value: string) {
    setLocality(value);
    if (value) focusRegion('location', value);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* The quickest way first: most people add the place they are standing in. */}
      <Button
        type="button"
        className="w-full"
        loading={locating}
        startIcon={<LocateFixed className="h-4 w-4" aria-hidden />}
        onClick={() => void locate()}
      >
        {t('submit.map.myLocation')}
      </Button>
      {/* Open by default on desktop, where there is room; on phones it waits behind one line. */}
      <details open={isDesktop} className="group rounded-xl border border-line px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
          {t('submit.map.orPickRegion')}
          <ChevronDown
            className="h-4 w-4 text-muted transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label={t('submit.map.city')} name="submit-location-city">
              <SelectInput
                id="submit-location-city"
                value={city}
                onChange={(event) => chooseCity(event.target.value)}
                options={cities.map((value) => ({ value, label: value }))}
                placeholder={
                  regionsQuery.isLoading ? t('submit.map.loadingRegions') : t('search.chooseValue')
                }
                disabled={regionsQuery.isLoading || regionsQuery.isError}
                searchable
              />
            </FormField>
            <FormField label={t('submit.map.region')} name="submit-location-region">
              <SelectInput
                id="submit-location-region"
                value={region}
                onChange={(event) => chooseRegion(event.target.value)}
                options={areaOptions.map((value) => ({ value, label: value }))}
                placeholder={t('submit.map.chooseCityFirst')}
                disabled={!city || regionsQuery.isLoading || regionsQuery.isError}
                searchable
              />
            </FormField>
            <FormField label={t('submit.map.locality')} name="submit-location-locality">
              <SelectInput
                id="submit-location-locality"
                value={locality}
                onChange={(event) => chooseLocality(event.target.value)}
                options={localities.map((value) => ({ value, label: value }))}
                placeholder={t('submit.map.chooseRegionFirst')}
                disabled={
                  !region || regionsQuery.isLoading || regionsQuery.isError || localities.length === 0
                }
                searchable
              />
            </FormField>
          </div>
          {regionsQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-danger">
              <span>{t('submit.map.regionsFailed')}</span>
              <Button size="sm" variant="secondary" onClick={() => void regionsQuery.refetch()}>
                {t('submit.map.retryRegions')}
              </Button>
            </div>
          )}
          <p className="text-sm text-muted">{t('submit.map.regionHint')}</p>
        </div>
      </details>
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
      </div>
      <p className="text-sm text-muted">{t(value ? 'submit.map.picked' : 'submit.map.hint')}</p>
    </div>
  );
}

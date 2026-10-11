import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import OlMap from 'ol/Map';
import View from 'ol/View';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import type { Coordinate } from '@/features/map/config';
import { DEFAULT_CENTER } from '@/features/map/config';
import { createBasemaps } from '@/features/map/layers';
import { palestineGrid } from '@/features/map/projection';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import SelectInput from '@/components/ui/SelectInput';
import type { LandPolygon } from '@/api/listingSubmissions';
import { representativePoint, toGeometryData } from '@/features/map/edit/geometry';
import { fetchRegions, matchingRegions, regionValues, regionsExtent } from './regionPicker';
import type { RegionField } from './regionPicker';

const polygonStyle = new Style({
  fill: new Fill({ color: 'rgba(14, 165, 233, 0.2)' }),
  stroke: new Stroke({ color: '#0284c7', width: 3 }),
});

const regionStyle = new Style({
  fill: new Fill({ color: 'rgba(109, 40, 217, 0.12)' }),
  stroke: new Stroke({ color: '#6d28d9', width: 2.5 }),
});

export default function LandPolygonPicker({
  value,
  onChange,
  invalid,
  readOnly = false,
  tall = false,
}: {
  value: LandPolygon | null;
  onChange?: (geometry: LandPolygon | null, center: Coordinate | null) => void;
  invalid?: boolean;
  readOnly?: boolean;
  tall?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const id = useId().replace(/:/g, '');
  const target = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  const regionSourceRef = useRef<VectorSource | null>(null);
  const drawRef = useRef<Draw | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValue = useRef(value);
  const [drawing, setDrawing] = useState(false);
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [locality, setLocality] = useState('');
  const regionsQuery = useQuery({
    queryKey: ['listing-location-regions'],
    queryFn: ({ signal }) => fetchRegions(signal),
    enabled: !readOnly,
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

  const publish = useCallback((geometry: Polygon) => {
    const data = toGeometryData(geometry, 'Polygon');
    if (!data || data.type !== 'Polygon' || data.coordinates.length !== 1) return;
    const center = representativePoint(data);
    onChangeRef.current?.({ type: 'Polygon', coordinates: [data.coordinates[0]] }, center);
  }, []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const source = new VectorSource();
    const layer = new VectorLayer({ source, style: polygonStyle });
    const regionSource = new VectorSource();
    const regionLayer = new VectorLayer({ source: regionSource, style: regionStyle });
    regionLayer.set('key', 'listing-location-region');
    const initial = initialValue.current;
    const map = new OlMap({
      target: target.current!,
      layers: [createBasemaps().esri!, regionLayer, layer],
      controls: [],
      view: new View({
        projection: palestineGrid,
        center: DEFAULT_CENTER,
        zoom: 14,
        maxZoom: 21,
        constrainResolution: true,
        enableRotation: false,
      }),
    });
    sourceRef.current = source;
    regionSourceRef.current = regionSource;
    mapRef.current = map;

    if (initial) {
      const feature = new Feature({ geometry: new Polygon(initial.coordinates) });
      source.addFeature(feature);
      map.getView().fit(feature.getGeometry()!.getExtent(), { padding: [40, 40, 40, 40], maxZoom: 19 });
    }

    if (!readOnly) {
      const modify = new Modify({ source, pixelTolerance: 14 });
      modify.on('modifyend', () => {
        const geometry = source.getFeatures()[0]?.getGeometry();
        if (geometry instanceof Polygon) publish(geometry);
      });
      map.addInteraction(modify);
    }

    const resize = new ResizeObserver(() => map.updateSize());
    resize.observe(target.current!);
    return () => {
      resize.disconnect();
      map.setTarget(undefined);
      map.dispose();
      sourceRef.current = null;
      regionSourceRef.current = null;
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [publish, readOnly]);

  function focusRegion(field: RegionField, value: string) {
    const filters =
      field === 'gov_a'
        ? { gov_a: value }
        : field === 'village_a'
          ? { gov_a: city, village_a: value }
          : { gov_a: city, village_a: region, location: value };
    const selected = matchingRegions(regions, filters);
    const extent = regionsExtent(selected);
    if (!extent) return;

    if (drawRef.current && mapRef.current) {
      mapRef.current.removeInteraction(drawRef.current);
      drawRef.current = null;
      setDrawing(false);
    }
    sourceRef.current?.clear();
    onChangeRef.current?.(null, null);
    const regionSource = regionSourceRef.current;
    regionSource?.clear();
    regionSource?.addFeatures(selected);
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

  function startDrawing() {
    const map = mapRef.current;
    const source = sourceRef.current;
    if (!map || !source) return;
    onChangeRef.current?.(null, null);
    source.clear();
    const draw = new Draw({ source, type: 'Polygon' });
    drawRef.current = draw;
    draw.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      map.removeInteraction(draw);
      drawRef.current = null;
      setDrawing(false);
      if (geometry instanceof Polygon) publish(geometry);
    });
    map.addInteraction(draw);
    setDrawing(true);
  }

  function clear() {
    if (drawRef.current && mapRef.current) {
      mapRef.current.removeInteraction(drawRef.current);
      drawRef.current = null;
    }
    sourceRef.current?.clear();
    onChangeRef.current?.(null, null);
    setDrawing(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label={t('submit.map.city')} name={`land-location-${id}-city`}>
              <SelectInput
                id={`land-location-${id}-city`}
                value={city}
                onChange={(event) => chooseCity(event.target.value)}
                options={cities.map((value) => ({ value, label: value }))}
                placeholder={regionsQuery.isLoading ? t('submit.map.loadingRegions') : t('search.chooseValue')}
                disabled={regionsQuery.isLoading || regionsQuery.isError}
                searchable
              />
            </FormField>
            <FormField label={t('submit.map.region')} name={`land-location-${id}-region`}>
              <SelectInput
                id={`land-location-${id}-region`}
                value={region}
                onChange={(event) => chooseRegion(event.target.value)}
                options={areaOptions.map((value) => ({ value, label: value }))}
                placeholder={t('submit.map.chooseCityFirst')}
                disabled={!city || regionsQuery.isLoading || regionsQuery.isError}
                searchable
              />
            </FormField>
            <FormField label={t('submit.map.locality')} name={`land-location-${id}-locality`}>
              <SelectInput
                id={`land-location-${id}-locality`}
                value={locality}
                onChange={(event) => chooseLocality(event.target.value)}
                options={localities.map((value) => ({ value, label: value }))}
                placeholder={t('submit.map.chooseRegionFirst')}
                disabled={!region || regionsQuery.isLoading || regionsQuery.isError || localities.length === 0}
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
        </>
      )}
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
          aria-label={t('submit.landMap.label')}
          className="absolute inset-0"
        />
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={drawing}
            startIcon={<Pencil className="h-4 w-4" aria-hidden />}
            onClick={startDrawing}
          >
            {t(drawing ? 'submit.landMap.drawing' : 'submit.landMap.draw')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!value && !drawing}
            startIcon={<Trash2 className="h-4 w-4" aria-hidden />}
            onClick={clear}
          >
            {t('submit.landMap.clear')}
          </Button>
        </div>
      )}
      <p className="text-sm text-muted">{t(value ? 'submit.landMap.picked' : 'submit.landMap.hint')}</p>
    </div>
  );
}

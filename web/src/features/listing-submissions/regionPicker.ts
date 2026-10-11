import GeoJSON from 'ol/format/GeoJSON';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import { createEmpty, extend, isEmpty, type Extent } from 'ol/extent';
import { fetchWfs } from '@/api/geoserver';
import { WFS_TIMEOUT_MS } from '@/features/map/config';
import { PALESTINE_GRID } from '@/features/map/projection';

export type RegionField = 'gov_a' | 'village_a' | 'location';
export type RegionFilters = Partial<Record<RegionField, string>>;

const geojson = new GeoJSON({ dataProjection: PALESTINE_GRID, featureProjection: PALESTINE_GRID });

export async function fetchRegions(signal?: AbortSignal): Promise<Feature<Geometry>[]> {
  const data = await fetchWfs(
    {
      workspace: 'realestate',
      typeName: 'Location',
      srsName: PALESTINE_GRID,
      maxFeatures: 10_000,
    },
    { timeoutMs: WFS_TIMEOUT_MS, signal },
  );
  const features = geojson.readFeatures(data) as Feature<Geometry>[];
  return features.filter((feature) => {
    const geometry = feature.getGeometry();
    const city = feature.get('gov_a');
    const region = feature.get('village_a');
    return (
      geometry &&
      typeof city === 'string' &&
      city.trim() !== '' &&
      typeof region === 'string' &&
      region.trim() !== ''
    );
  });
}

export function matchingRegions(features: readonly Feature<Geometry>[], filters: RegionFilters) {
  return features.filter((feature) =>
    (Object.entries(filters) as [RegionField, string][]).every(
      ([field, value]) => !value || feature.get(field) === value,
    ),
  );
}

export function regionValues(
  features: readonly Feature<Geometry>[],
  field: RegionField,
  filters: RegionFilters,
  language: string,
): string[] {
  return [
    ...new Set(
      matchingRegions(features, filters)
        .map((feature) => feature.get(field))
        .filter((value): value is string => typeof value === 'string' && value.trim() !== ''),
    ),
  ].sort((a, b) => a.localeCompare(b, language === 'en' ? 'en' : 'ar'));
}

export function regionsExtent(features: readonly Feature<Geometry>[]): Extent | null {
  const extent = createEmpty();
  for (const feature of features) {
    const geometry = feature.getGeometry();
    if (geometry) extend(extent, geometry.getExtent());
  }
  return isEmpty(extent) ? null : extent;
}

import type { Extent } from 'ol/extent';
import { getCenter } from 'ol/extent';
import GeoJSON from 'ol/format/GeoJSON';
import type Geometry from 'ol/geom/Geometry';
import type { ApiFeature, FeatureCollectionResponse } from '@/api/search';
import type { Coordinate } from '../config';
import { PALESTINE_GRID } from '../projection';
import { resolveFeatureId, type Props, type SelectedFeature } from '../popup/featureModel';
import { targetFromKey, type MapTarget } from '../targets';
import { geometryMeasure } from '../popup/geometryMeasure';

/** One row of a result list: plain data + the OL geometry (needed to fit/draw). Distance is set by nearby search. */
export interface SearchResult {
  key: string;
  target: MapTarget;
  id: string | null;
  props: Props;
  geometry: Geometry;
  center: Coordinate;
  extent: Extent;
  rating: number;
  distance?: number;
}

const reader = new GeoJSON({ dataProjection: PALESTINE_GRID, featureProjection: PALESTINE_GRID });

export const ratingOf = (props: Props) => Number.parseFloat(String(props.rating)) || 0;

/** Legacy order everywhere: rating, highest first. */
export const byRatingDesc = (a: { rating: number }, b: { rating: number }) => b.rating - a.rating;

function toResult(f: ApiFeature, target: MapTarget, index: number): SearchResult | null {
  if (!f.geometry) return null;
  const geometry = reader.readGeometry(f.geometry);
  const extent = geometry.getExtent();
  if (extent.some((n) => !Number.isFinite(n))) return null; // rows with no usable coordinates
  const props = f.properties;
  const id = resolveFeatureId(props, undefined);
  return {
    key: `${targetKeyOf(target)}:${id ?? index}`,
    target,
    id,
    props,
    geometry,
    center: getCenter(extent) as Coordinate,
    extent,
    rating: ratingOf(props),
  };
}

const targetKeyOf = (t: MapTarget) => (t.kind === 'realEstate' ? t.layer : t.discriminator);

/**
 * API response → results. `target` is fixed for single-type queries; for `service_all` / mixed queries each row's
 * `discriminator` decides (unknown types are dropped — the map can't draw or describe them).
 */
export function toResults(fc: FeatureCollectionResponse, target: MapTarget | null): SearchResult[] {
  const out: SearchResult[] = [];
  fc.features.forEach((f, i) => {
    const t =
      target ??
      (typeof f.properties.discriminator === 'string' ? targetFromKey(f.properties.discriminator) : null);
    const r = t && toResult(f, t, i);
    if (r) out.push(r);
  });
  return out;
}

/** Snapshot for the details card (FeatureCard). */
export function toSelected(r: SearchResult): SelectedFeature {
  return {
    kind: r.target,
    id: r.id,
    props: r.props,
    coordinate: r.center,
    measure: geometryMeasure(r.geometry),
  };
}

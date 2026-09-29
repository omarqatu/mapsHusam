import Geometry from 'ol/geom/Geometry';
import { measureGeometry } from '../tools/measure';
import type { SelectedFeature } from './featureModel';

/** Measure of a feature's own geometry for its details card. Points (and render-only features) have none. */
export function geometryMeasure(geom: unknown): SelectedFeature['measure'] {
  const m = geom instanceof Geometry ? measureGeometry(geom) : null;
  return m && m.kind !== 'point' ? m : undefined;
}

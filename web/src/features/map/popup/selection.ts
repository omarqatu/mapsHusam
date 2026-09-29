import type { FeatureLike } from 'ol/Feature';
import { REAL_ESTATE_LAYERS, type Coordinate } from '../config';
import { targetFromKey } from '../targets';
import { resolveFeatureId, type Props, type SelectedFeature } from './featureModel';
import { geometryMeasure } from './geometryMeasure';

/** Minimal shape of an OpenLayers layer we read from (its `key` was set in layers.ts). */
interface KeyedLayer {
  get(name: string): unknown;
}

/**
 * Turn a clicked map feature into the plain snapshot the details card renders.
 * Only layers/types the map knows are selectable (legacy isLayerAllowed): unknown discriminators are ignored.
 */
export function featureToSelection(
  feature: FeatureLike,
  layer: KeyedLayer | null,
  coordinate: Coordinate,
): SelectedFeature | null {
  const key = layer?.get('key');
  const { geometry: _geometry, ...props } = feature.getProperties() as Props;
  const id = resolveFeatureId(props, feature.getId());

  if (key === 'services') {
    const discriminator = props.discriminator;
    if (typeof discriminator !== 'string') return null;
    const target = targetFromKey(discriminator);
    if (target?.kind !== 'service') return null;
    return { kind: target, id, props, coordinate };
  }
  const re = REAL_ESTATE_LAYERS.find((l) => l.key === key);
  if (re) {
    const geom = feature.getGeometry();
    return {
      kind: { kind: 'realEstate', layer: re.key },
      id,
      props,
      coordinate,
      measure: geometryMeasure(
        geom && 'getType' in geom && geom.getType() !== 'Point' ? (geom as never) : null,
      ),
    };
  }
  return null;
}

import type { FeatureLike } from 'ol/Feature';
import { REAL_ESTATE_LAYERS, SERVICE_TYPE_BY_KEY, type Coordinate } from '../config';
import { resolveFeatureId, type Props, type SelectedFeature } from './featureModel';

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
    const type = SERVICE_TYPE_BY_KEY.get(discriminator);
    if (!type) return null;
    return { kind: { kind: 'service', discriminator, icon: type.icon }, id, props, coordinate };
  }
  const re = REAL_ESTATE_LAYERS.find((l) => l.key === key);
  if (re) return { kind: { kind: 'realEstate', layer: re.key }, id: id, props, coordinate };
  return null;
}

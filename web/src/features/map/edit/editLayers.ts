import type OlMap from 'ol/Map';
import type BaseLayer from 'ol/layer/Base';
import type VectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import type { StyleFunction } from 'ol/style/Style';
import { createWfsLayer } from '../layers';
import { EDIT_ONLY_LAYERS } from './schema';

const BRAND = '#f9a825';

/** What is being drawn or edited: the feature itself, drawn on top of every layer. */
export const overlayStyle: StyleFunction = (feature) => {
  const type = feature.getGeometry()?.getType();
  return new Style({
    stroke: new Stroke({ color: BRAND, width: 4 }),
    fill: new Fill({ color: 'rgba(249, 168, 37, 0.25)' }),
    image: new Circle({
      radius: 13,
      fill: new Fill({ color: 'rgba(249, 168, 37, 0.35)' }),
      stroke: new Stroke({ color: BRAND, width: 3 }),
    }),
    zIndex: type === 'Point' ? 3 : 1,
  });
};

/** Selection ring while picking: the Select interaction replaces the feature's own (icon) style with this. */
export const selectStyle: StyleFunction = overlayStyle;

const roadStyle = new Style({ stroke: new Stroke({ color: '#c2410c', width: 3 }) });
const regionStyle = new Style({
  stroke: new Stroke({ color: '#6d28d9', width: 2, lineDash: [8, 6] }),
  fill: new Fill({ color: 'rgba(109, 40, 217, 0.06)' }),
});

/** Layers that exist only for editing (roads, regions): loaded through the same WFS loader as the map's layers. */
export function createEditOnlyLayer(key: 'roads' | 'locations', onError?: () => void): VectorLayer {
  const def = EDIT_ONLY_LAYERS[key];
  return createWfsLayer({ key, ...def }, key === 'roads' ? roadStyle : regionStyle, onError);
}

/** A map layer by the `key` layers.ts gave it. */
export function findLayer(map: OlMap, key: string): VectorLayer | null {
  const found = map
    .getLayers()
    .getArray()
    .find((l: BaseLayer) => l.get('key') === key);
  return (found as VectorLayer | undefined) ?? null;
}

export const sourceOf = (layer: VectorLayer) => layer.getSource() as VectorSource;

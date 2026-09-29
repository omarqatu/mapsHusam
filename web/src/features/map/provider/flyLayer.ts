import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import type OlMap from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import type { Coordinate } from '../config';

// Legacy `providerFlyToLayer`: a red dot with a white ring where the provider's service sits, kept until the next fly.
const LAYER_KEY = 'providerFlyToLayer';
const style = new Style({
  image: new Circle({
    radius: 12,
    fill: new Fill({ color: 'red' }),
    stroke: new Stroke({ color: '#fff', width: 3 }),
  }),
});

const find = (map: OlMap) =>
  map.getLayers().getArray().find((l) => l.get('key') === LAYER_KEY) as VectorLayer | undefined;

/** Marks the position and flies there at zoom 19 (1.2 s, legacy). */
export function flyToProvider(map: OlMap, at: Coordinate) {
  let layer = find(map);
  if (!layer) {
    layer = new VectorLayer({ source: new VectorSource(), style, zIndex: 2000, properties: { key: LAYER_KEY } });
    map.addLayer(layer);
  }
  const source = layer.getSource()!;
  source.clear();
  source.addFeature(new Feature(new Point(at)));
  map.getView().animate({ center: at, zoom: 19, duration: 1200 });
}

export function clearProviderMarker(map: OlMap) {
  const layer = find(map);
  if (layer) map.removeLayer(layer);
}

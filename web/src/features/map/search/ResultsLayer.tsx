import { useEffect } from 'react';
import Feature from 'ol/Feature';
import { buffer, createEmpty, extend } from 'ol/extent';
import Point from 'ol/geom/Point';
import CircleGeom from 'ol/geom/Circle';
import { unByKey } from 'ol/Observable';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import { useOlMap } from '../MapContext';
import { useSearchUi } from './store';

const RESULT = new Style({
  image: new Circle({
    radius: 10,
    fill: new Fill({ color: '#ffff00' }),
    stroke: new Stroke({ color: '#000', width: 2 }),
  }),
  stroke: new Stroke({ color: '#ffff00', width: 4 }),
  fill: new Fill({ color: 'rgba(255, 255, 0, 0.3)' }),
});
const RADIUS = new Style({
  stroke: new Stroke({ color: 'rgba(0, 123, 255, 0.6)', width: 2, lineDash: [5, 5] }),
  fill: new Fill({ color: 'rgba(0, 123, 255, 0.1)' }),
});
const CENTER = new Style({
  image: new Circle({
    radius: 12,
    fill: new Fill({ color: '#007bff' }),
    stroke: new Stroke({ color: '#fff', width: 4 }),
  }),
});

/** Headroom for the bottom sheet on phones so results are fitted into the part of the map that stays visible. */
const padding = (): [number, number, number, number] =>
  window.innerWidth < 640 ? [80, 40, Math.round(window.innerHeight * 0.55), 40] : [80, 80, 80, 80];

/**
 * Draws the current search on the map (yellow results, blue radius circle + centre) and fits the view to it.
 * Also captures the "pick a point on the map" tap for nearby search.
 */
export default function ResultsLayer() {
  const map = useOlMap();

  useEffect(() => {
    if (!map) return;
    const source = new VectorSource();
    const layer = new VectorLayer({
      source,
      zIndex: 1900,
      style: (f) => (f.get('role') === 'radius' ? RADIUS : f.get('role') === 'center' ? CENTER : RESULT),
    });
    map.addLayer(layer);

    const draw = () => {
      const { results, nearbyCenter } = useSearchUi.getState();
      source.clear();
      if (results) {
        source.addFeatures(
          results.items.map((r) => new Feature({ geometry: r.geometry.clone(), role: 'result' })),
        );
        if (results.nearby?.radius)
          source.addFeature(
            new Feature({
              geometry: new CircleGeom(results.nearby.center, results.nearby.radius),
              role: 'radius',
            }),
          );
      }
      if (nearbyCenter) source.addFeature(new Feature({ geometry: new Point(nearbyCenter), role: 'center' }));
    };
    draw();

    let lastVersion = useSearchUi.getState().results?.version ?? 0;
    const unsubscribe = useSearchUi.subscribe((s, prev) => {
      if (s.results !== prev.results || s.nearbyCenter !== prev.nearbyCenter) draw();
      if (s.results && s.results.version !== lastVersion) {
        lastVersion = s.results.version;
        const extent = createEmpty();
        s.results.items.forEach((r) => extend(extent, r.extent));
        if (s.results.nearby)
          extend(
            extent,
            buffer([...s.results.nearby.center, ...s.results.nearby.center], s.results.nearby.radius ?? 0),
          );
        map.getView().fit(extent, { padding: padding(), duration: 1000, maxZoom: s.results.fitMaxZoom });
      }
    });

    // Nearby search: the next tap chooses the search point (SelectionController ignores taps while picking).
    const tap = map.on('singleclick', (e) => {
      const ui = useSearchUi.getState();
      if (!ui.picking) return;
      ui.setNearbyCenter(e.coordinate as [number, number]);
      ui.setPicking(false);
    });

    return () => {
      unByKey(tap);
      unsubscribe();
      map.removeLayer(layer);
    };
  }, [map]);

  return null;
}

import { useEffect } from 'react';
import Feature from 'ol/Feature';
import type OlMap from 'ol/Map';
import Point from 'ol/geom/Point';
import { unByKey } from 'ol/Observable';
import type Layer from 'ol/layer/Layer';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import { useOlMap } from '../MapContext';
import { useMapUi } from '../store';
import { useSearchUi } from '../search/store';
import type { SelectedFeature } from './featureModel';
import { logMapClick } from './logMapClick';
import { featureToSelection } from './selection';

/** Finger-sized hit area: markers are 32px and phones are imprecise (legacy used 0). */
const HIT_TOLERANCE = 8;

const highlightStyle = new Style({
  image: new Circle({
    radius: 22,
    fill: new Fill({ color: 'rgba(255, 235, 59, 0.35)' }),
    stroke: new Stroke({ color: '#f9a825', width: 3 }),
  }),
});

/**
 * The card is a bottom sheet on phones and a side card on desktop: pad the view so "centre" means the visible part above it —
 * a marker reached by a fly-to (search pick) or a tap then stays in sight. Cleared when the card closes.
 */
function fitAboveSheet(map: OlMap, coordinate: [number, number] | null) {
  const view = map.getView();
  const size = map.getSize();
  if (!coordinate || !size) {
    view.padding = [0, 0, 0, 0];
    return;
  }
  if (window.innerWidth >= 640) {
    // Desktop: the card (20rem + gutter) covers the start edge, so centre in what is left. Start is the right in RTL.
    const cardWidth = 344;
    view.padding = document.dir === 'rtl' ? [0, cardWidth, 0, 0] : [0, 0, 0, cardWidth];
  } else view.padding = [0, 0, Math.round(size[1] * 0.5), 0];
  // A running fly-to already ends at the padded centre; only a plain tap needs its own pan.
  if (!view.getAnimating()) view.animate({ center: coordinate, duration: 250 });
}

/** Click a marker → details card. Also owns the highlight ring and the pointer cursor. */
export default function SelectionController() {
  const map = useOlMap();

  useEffect(() => {
    if (!map) return;
    const source = new VectorSource();
    const ring = new VectorLayer({ source, style: highlightStyle, zIndex: 2000 });
    map.addLayer(ring);

    const sync = (sel = useMapUi.getState().selected) => {
      source.clear();
      fitAboveSheet(map, sel?.coordinate ?? null);
      if (!sel) return;
      source.addFeature(new Feature(new Point(sel.coordinate)));
    };
    sync();
    const unsubscribe = useMapUi.subscribe((s, prev) => s.selected !== prev.selected && sync(s.selected));

    const dataLayer = (l: unknown): l is Layer => !!l && (l as Layer).get('key') !== undefined;
    const clickKey = map.on('singleclick', (e) => {
      if (useSearchUi.getState().picking) return; // this tap chooses a search point
      if (useMapUi.getState().activeTool) return; // measure / share tool owns the tap
      let picked: SelectedFeature | null = null;
      map.forEachFeatureAtPixel(
        e.pixel,
        (feature, layer) => {
          picked = featureToSelection(feature, layer, e.coordinate as [number, number]);
          return picked ? true : undefined; // stop at the first selectable feature (top-most layer first)
        },
        { hitTolerance: HIT_TOLERANCE, layerFilter: dataLayer },
      );
      useMapUi.getState().setSelected(picked);

      if (picked) logMapClick(picked);
    });

    const moveKey = map.on('pointermove', (e) => {
      if (e.dragging || useMapUi.getState().activeTool) return; // an active tool sets its own cursor
      const over = map.hasFeatureAtPixel(e.pixel, { hitTolerance: HIT_TOLERANCE, layerFilter: dataLayer });
      map.getTargetElement().style.cursor = over ? 'pointer' : '';
    });

    return () => {
      unByKey([clickKey, moveKey]);
      unsubscribe();
      map.removeLayer(ring);
    };
  }, [map]);

  return null;
}

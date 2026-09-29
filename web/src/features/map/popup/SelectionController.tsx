import { useEffect } from 'react';
import Feature from 'ol/Feature';
import type OlMap from 'ol/Map';
import Point from 'ol/geom/Point';
import { unByKey } from 'ol/Observable';
import type Layer from 'ol/layer/Layer';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import { mapEventsApi } from '@/api/mapEvents';
import i18n from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { useOlMap } from '../MapContext';
import { useMapUi } from '../store';
import { text, type SelectedFeature } from './featureModel';
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

/** On phones the card is a bottom sheet (max 70% of the height): pan so the tapped marker stays visible above it. */
function revealAboveSheet(map: OlMap, coordinate: [number, number]) {
  if (window.innerWidth >= 640) return;
  const size = map.getSize();
  const pixel = map.getPixelFromCoordinate(coordinate);
  if (!size || !pixel) return;
  const visibleBottom = size[1] * 0.3 - 24; // sheet covers the lower 70%
  if (pixel[1] <= visibleBottom) return;
  const target = map.getCoordinateFromPixel([pixel[0], pixel[1] - (pixel[1] - size[1] * 0.15)]);
  const view = map.getView();
  const center = view.getCenter();
  if (!target || !center) return;
  view.animate({
    center: [center[0] + (coordinate[0] - target[0]), center[1] + (coordinate[1] - target[1])],
    duration: 250,
  });
}

/** Click a marker → details card. Also owns the highlight ring, the pointer cursor and Escape-to-close. */
export default function SelectionController() {
  const map = useOlMap();

  useEffect(() => {
    if (!map) return;
    const source = new VectorSource();
    const ring = new VectorLayer({ source, style: highlightStyle, zIndex: 2000 });
    map.addLayer(ring);

    const sync = (sel = useMapUi.getState().selected) => {
      source.clear();
      if (!sel) return;
      source.addFeature(new Feature(new Point(sel.coordinate)));
      revealAboveSheet(map, sel.coordinate);
    };
    sync();
    const unsubscribe = useMapUi.subscribe((s, prev) => s.selected !== prev.selected && sync(s.selected));

    const dataLayer = (l: unknown): l is Layer => !!l && (l as Layer).get('key') !== undefined;
    const clickKey = map.on('singleclick', (e) => {
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

      const user = useAuthStore.getState().user;
      if (picked && user) {
        const sel: SelectedFeature = picked;
        const ar = i18n.getFixedT('ar');
        const title =
          sel.kind.kind === 'service'
            ? ar(`services.${sel.kind.discriminator}`)
            : sel.kind.kind === 'realEstate'
              ? ar(`layers.${sel.kind.layer}`)
              : '';
        // Stats for the admin dashboard (legacy map_click). Never blocks or surfaces errors to the user.
        void mapEventsApi
          .logMapEvent({
            event_type: 'map_click',
            provider: text(sel.props.name) || text(sel.props.location_name) || 'غير معروف',
            service: title,
          })
          .catch(() => undefined);
      }
    });

    const moveKey = map.on('pointermove', (e) => {
      if (e.dragging) return;
      const over = map.hasFeatureAtPixel(e.pixel, { hitTolerance: HIT_TOLERANCE, layerFilter: dataLayer });
      map.getTargetElement().style.cursor = over ? 'pointer' : '';
    });

    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && useMapUi.getState().setSelected(null);
    document.addEventListener('keydown', onKey);

    return () => {
      unByKey([clickKey, moveKey]);
      document.removeEventListener('keydown', onKey);
      unsubscribe();
      map.removeLayer(ring);
    };
  }, [map]);

  return null;
}

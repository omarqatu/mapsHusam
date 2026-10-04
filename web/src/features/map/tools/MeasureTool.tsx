import { useEffect, useRef, useState, type ReactNode } from 'react';
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import Draw from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import { MapPin, Ruler, Square, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useOlMap } from '../MapContext';
import MapSheet from '../panels/MapSheet';
import { useMapUi } from '../store';
import {
  DRAW_TYPE,
  formatMeasureNumber,
  measureGeometry,
  setDoubleClickZoom,
  type MeasureMode,
  type MeasureResult,
} from './measure';

const drawnStyle = new Style({
  fill: new Fill({ color: 'rgba(255, 204, 51, 0.2)' }),
  stroke: new Stroke({ color: '#ffcc33', width: 3 }),
  image: new Circle({
    radius: 7,
    fill: new Fill({ color: '#ffcc33' }),
    stroke: new Stroke({ color: '#fff', width: 2 }),
  }),
});

/** What the result box shows: nothing yet, "cleared", or the measurement (live while drawing, final after). */
type Display = { type: 'none' } | { type: 'cleared' } | { type: 'result'; result: MeasureResult };

const MODES: { mode: MeasureMode; icon: typeof Ruler }[] = [
  { mode: 'length', icon: Ruler },
  { mode: 'area', icon: Square },
  { mode: 'point', icon: MapPin },
];

function ResultBox({ display }: { display: Display }) {
  const { t } = useTranslation();
  let body: ReactNode = t('tools.measure.empty');
  if (display.type === 'cleared') body = t('tools.measure.cleared');
  else if (display.type === 'result') {
    const r = display.result;
    if (r.kind === 'length') body = t('tools.measure.distance', { value: formatMeasureNumber(r.meters) });
    else if (r.kind === 'area')
      body = t('tools.measure.areaResult', { value: formatMeasureNumber(r.squareMeters) });
    else
      body = (
        <>
          <span className="block">{t('tools.measure.pointTitle')}</span>
          <span dir="ltr" className="block">
            {t('tools.measure.easting', { value: formatMeasureNumber(r.easting) })}
          </span>
          <span dir="ltr" className="block">
            {t('tools.measure.northing', { value: formatMeasureNumber(r.northing) })}
          </span>
        </>
      );
  }
  return (
    <div
      role="status"
      className="mt-4 min-h-10 rounded-lg bg-subtle p-3 text-center text-sm font-bold text-fg"
    >
      {body}
    </div>
  );
}

interface PanelProps {
  source: VectorSource;
  display: Display;
  setDisplay: (d: Display) => void;
  onClose: () => void;
}

/** The open panel. Mounted only while the tool is open, so closing it drops the pending drawing (legacy). */
function MeasurePanel({ source, display, setDisplay, onClose }: PanelProps) {
  const { t } = useTranslation();
  const map = useOlMap();
  const [mode, setMode] = useState<MeasureMode | null>(null);
  /** A line/polygon has been started but not finished. */
  const [sketching, setSketching] = useState(false);
  const draw = useRef<Draw | null>(null);
  const dblClickTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!map || !mode) return;
    const interaction = new Draw({ source, type: DRAW_TYPE[mode] });
    const keys: EventsKey[] = [];
    let sketchKey: EventsKey | undefined;
    const show = (geom: Geometry | undefined) => {
      const result = geom && measureGeometry(geom);
      if (result) setDisplay({ type: 'result', result });
    };

    // A double click ends a line/polygon and would also zoom the map: off while drawing.
    window.clearTimeout(dblClickTimer.current);
    setDoubleClickZoom(map, false);
    const target = map.getTargetElement();
    target.style.cursor = 'crosshair';

    keys.push(
      interaction.on('drawstart', (evt) => {
        setSketching(mode !== 'point');
        if (mode === 'point') return;
        const geom = (evt.feature as Feature).getGeometry();
        show(geom);
        sketchKey = geom?.on('change', () => show(geom)); // live length / area while the shape grows
      }),
      interaction.on('drawend', (evt) => {
        show((evt.feature as Feature).getGeometry());
        setSketching(false);
        setMode(null); // legacy: one shape per button press
      }),
      interaction.on('drawabort', () => {
        setSketching(false);
        setMode(null);
      }),
    );
    map.addInteraction(interaction);
    draw.current = interaction;

    return () => {
      if (sketchKey) unByKey(sketchKey);
      unByKey(keys);
      map.removeInteraction(interaction);
      draw.current = null;
      target.style.cursor = '';
      // drawend fires while the double click is still being handled: re-enable on the next tick.
      dblClickTimer.current = window.setTimeout(() => setDoubleClickZoom(map, true), 0);
    };
  }, [map, mode, source, setDisplay]);

  // Escape cancels the shape being drawn.
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      setSketching(false);
      setMode(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode]);

  const clear = () => {
    source.clear();
    setSketching(false);
    setMode(null);
    setDisplay({ type: 'cleared' });
  };

  return (
    <MapSheet side="end" label={t('tools.measure.title')} title={t('tools.measure.title')} onClose={onClose}>
      <div className="space-y-2">
        {MODES.map(({ mode: m, icon: Icon }) => (
          <Button
            key={m}
            size="sm"
            variant={mode === m ? 'primary' : 'secondary'}
            aria-pressed={mode === m}
            className="w-full justify-start"
            startIcon={<Icon className="h-4 w-4" />}
            onClick={() => {
              setSketching(false);
              setMode(mode === m ? null : m); // pressing the active button again cancels it
            }}
          >
            {t(`tools.measure.${m}`)}
          </Button>
        ))}
      </div>

      {mode && (
        <p className="mt-3 text-sm text-muted">
          {t(mode === 'point' ? 'tools.measure.hintPoint' : 'tools.measure.hintLine')}
        </p>
      )}
      {sketching && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" onClick={() => draw.current?.removeLastPoint()}>
            {t('tools.measure.undo')}
          </Button>
          <Button size="sm" onClick={() => draw.current?.finishDrawing()}>
            {t('tools.measure.finish')}
          </Button>
        </div>
      )}

      <hr className="my-3 border-line" />
      <Button
        size="sm"
        variant="danger"
        className="w-full"
        startIcon={<Trash2 className="h-4 w-4" />}
        onClick={clear}
      >
        {t('tools.measure.clear')}
      </Button>
      <ResultBox display={display} />
    </MapSheet>
  );
}

/** Measure distance / area and draw points (legacy measure.js): shapes live in their own layer and stay until cleared. */
export default function MeasureTool() {
  const map = useOlMap();
  const open = useMapUi((s) => s.activeTool === 'measure');
  const setActiveTool = useMapUi((s) => s.setActiveTool);
  const [source] = useState(() => new VectorSource());
  const [display, setDisplay] = useState<Display>({ type: 'none' });

  useEffect(() => {
    if (!map) return;
    const layer = new VectorLayer({ source, style: drawnStyle, zIndex: 1950 });
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, source]);

  if (!open) return null;
  return (
    <MeasurePanel
      source={source}
      display={display}
      setDisplay={setDisplay}
      onClose={() => setActiveTool(null)}
    />
  );
}

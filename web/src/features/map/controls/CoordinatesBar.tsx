import { useEffect, useRef } from 'react';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import { unByKey } from 'ol/Observable';
import { useOlMap } from '../MapContext';
import { formatGrid, formatLatLon } from '../mapUtils';
import { toLonLat } from '../projection';

/**
 * Pointer position in Palestine Grid (legacy bottom bar) and in WGS84 (as the water platform's status bar shows it).
 * Written straight to the DOM — no re-render per mouse move.
 */
export default function CoordinatesBar() {
  const map = useOlMap();
  const grid = useRef<HTMLSpanElement>(null);
  const gps = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!map) return;
    let frame = 0;
    const key = map.on('pointermove', (e: MapBrowserEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (grid.current) grid.current.textContent = formatGrid(e.coordinate);
        if (gps.current) gps.current.textContent = formatLatLon(toLonLat(e.coordinate));
      });
    });
    return () => {
      unByKey(key);
      cancelAnimationFrame(frame);
    };
  }, [map]);

  return (
    <div
      className="pointer-events-none hidden items-center gap-2 glass rounded-full px-3 py-1 font-mono text-xs text-fg sm:flex"
      dir="ltr"
    >
      <span ref={grid}>E: —, N: —</span>
      <span className="text-line-strong" aria-hidden>
        |
      </span>
      <span ref={gps} className="text-muted">
        —
      </span>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import { unByKey } from 'ol/Observable';
import { useOlMap } from '../MapContext';
import { formatGrid } from '../mapUtils';

/** Palestine Grid coordinates under the pointer (legacy bottom bar). Written straight to the DOM — no re-render per mouse move. */
export default function CoordinatesBar() {
  const map = useOlMap();
  const out = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!map) return;
    let frame = 0;
    const key = map.on('pointermove', (e: MapBrowserEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (out.current) out.current.textContent = formatGrid(e.coordinate);
      });
    });
    return () => {
      unByKey(key);
      cancelAnimationFrame(frame);
    };
  }, [map]);

  return (
    <div
      className="pointer-events-none hidden rounded-full bg-white/85 px-3 py-1 font-mono text-xs text-slate-700 shadow sm:block"
      dir="ltr"
    >
      <span ref={out}>E: —, N: —</span>
    </div>
  );
}

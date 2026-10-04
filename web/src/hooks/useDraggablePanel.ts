import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

interface Offset {
  x: number;
  y: number;
}
const ZERO: Offset = { x: 0, y: 0 };
const storageKey = (id: string) => `psm.panel.${id}`;

function load(id: string): Offset {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey(id)) ?? 'null') as Offset | null;
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : ZERO;
  } catch {
    return ZERO;
  }
}
function save(id: string, o: Offset) {
  try {
    if (o.x === 0 && o.y === 0) localStorage.removeItem(storageKey(id));
    else localStorage.setItem(storageKey(id), JSON.stringify(o));
  } catch {
    /* storage blocked: the position just isn't remembered */
  }
}

/**
 * Lets a floating panel be dragged by its header (legacy draggable panels), kept inside its container and remembered
 * per `id`. Double-click on the handle puts it back. The offset is applied through CSS variables and only from `sm` up
 * (see the `transform` class the caller adds), so phone bottom sheets are never moved.
 */
export function useDraggablePanel(id: string) {
  const panel = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState<Offset>(() => load(id));
  const live = useRef(offset);
  const start = useRef<{ px: number; py: number; from: Offset } | null>(null);

  const apply = (o: Offset) => {
    live.current = o;
    setOffset(o);
  };

  /** Moves `wanted` back so the whole panel stays inside the container it is positioned in. */
  const clamp = useCallback((wanted: Offset): Offset => {
    const el = panel.current;
    const box = el?.offsetParent?.getBoundingClientRect();
    if (!el || !box) return wanted;
    const r = el.getBoundingClientRect();
    const dx = wanted.x - live.current.x;
    const dy = wanted.y - live.current.y;
    const left = Math.min(Math.max(r.left + dx, box.left), box.right - r.width);
    const top = Math.min(Math.max(r.top + dy, box.top), box.bottom - r.height);
    return { x: live.current.x + (left - r.left), y: live.current.y + (top - r.top) };
  }, []);

  // A saved position may not fit a smaller window: pull it back in on mount and on resize.
  useEffect(() => {
    const fit = () => {
      if (window.innerWidth < 640) return;
      const next = clamp(live.current);
      if (next.x !== live.current.x || next.y !== live.current.y) {
        live.current = next;
        setOffset(next);
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [clamp]);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || window.innerWidth < 640) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return; // header buttons keep working
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, from: live.current };
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s) return;
    apply(clamp({ x: s.from.x + e.clientX - s.px, y: s.from.y + e.clientY - s.py }));
  };
  const end = () => {
    if (!start.current) return;
    start.current = null;
    save(id, live.current);
  };

  return {
    panelRef: panel,
    panelStyle: { '--dx': `${offset.x}px`, '--dy': `${offset.y}px` } as CSSProperties,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      onDoubleClick: () => {
        apply(ZERO);
        save(id, ZERO);
      },
    },
  };
}

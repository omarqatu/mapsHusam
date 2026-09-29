import { useEffect, type RefObject } from 'react';

/** Calls `onOutside` when a pointer goes down outside `ref` while `active` (dropdowns, popovers). */
export function useOutsideClick(ref: RefObject<HTMLElement | null>, onOutside: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [ref, onOutside, active]);
}

import { useSyncExternalStore } from 'react';

/** Tracks a CSS media query. Without `matchMedia` (jsdom, SSR) it reports `fallback`. */
export function useMediaQuery(query: string, fallback = true): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const mq = window.matchMedia(query);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}

/** Tailwind `md` and up: tables show as tables, below they turn into cards. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)');

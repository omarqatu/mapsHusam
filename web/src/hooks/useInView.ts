import { useCallback, useEffect, useState } from 'react';

/**
 * `true` once the element has come near the viewport, and it stays true (a one-shot "load when seen").
 * Without IntersectionObserver (old browsers, tests) the element counts as seen at once.
 */
export function useInView<T extends Element>(rootMargin = '200px'): [(el: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (seen || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setSeen(true);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, seen, rootMargin]);

  return [useCallback((node: T | null) => setEl(node), []), seen];
}

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * A row of cards that scrolls sideways: swipe on touch, arrow buttons on wider screens (a mouse cannot swipe). The
 * buttons hide at the ends. Works in RTL: "next" always moves toward the row's end.
 */
export default function ScrollRow({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft); // negative in RTL
    setEdge({ start: pos < 4, end: pos > max - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  const arrow =
    'absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-fg shadow-float transition hover:border-brand hover:text-brand-fg md:flex';
  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        role="group"
        aria-label={label}
        className="-mx-4 flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button type="button" onClick={() => go(-1)} aria-label={t('media.prev')} className={clsx(arrow, '-start-5', edge.start && 'md:hidden')}>
        <ChevronRight className="h-5 w-5 ltr:rotate-180" aria-hidden />
      </button>
      <button type="button" onClick={() => go(1)} aria-label={t('media.next')} className={clsx(arrow, '-end-5', edge.end && 'md:hidden')}>
        <ChevronLeft className="h-5 w-5 ltr:rotate-180" aria-hidden />
      </button>
    </div>
  );
}

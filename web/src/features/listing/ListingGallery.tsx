import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronRight, Expand } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MediaViewer, type VisualItem } from '@/components/ui/MediaGallery';
import { playBadge, ytThumb } from '@/components/ui/media';

const keyOf = (m: VisualItem) => (m.type === 'youtube' ? `y:${m.id}` : m.url);

function Still({ m, onBroken, eager }: { m: VisualItem; onBroken?: () => void; eager?: boolean }) {
  if (m.type === 'video')
    return (
      <video
        src={`${m.url}#t=0.5`}
        preload="metadata"
        muted
        playsInline
        className="h-full w-full object-cover"
      />
    );
  return (
    <img
      src={m.type === 'image' ? m.url : ytThumb(m.id)}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer"
      onError={onBroken}
      className="h-full w-full object-cover"
    />
  );
}

/**
 * The listing page's pictures, marketplace style: one large picture at a time (swipe on phones, arrows on desktop, a
 * "3 / 8" counter), thumbnails under it, and the full-screen viewer on a tap. A picture that fails to load is dropped.
 * `empty` is shown when there is nothing to show (the type's icon), so the page never opens on bare text.
 */
export default function ListingGallery({ items, empty }: { items: VisualItem[]; empty: ReactNode }) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const shown = items.filter((m) => !broken.has(keyOf(m)));
  const count = shown.length;

  // The slide in view is the current one, whichever way it got there (swipe, arrow, thumbnail).
  useEffect(() => {
    const root = track.current;
    // Without the observer (old browsers) the arrows and thumbnails still keep the counter right.
    if (!root || count < 2 || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.index));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll('[data-index]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [count]);

  const go = (i: number) => {
    const next = (i + count) % count;
    track.current
      ?.querySelector(`[data-index="${next}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    setCurrent(next);
  };
  const markBroken = (m: VisualItem) => () => setBroken((b) => new Set(b).add(keyOf(m)));

  if (count === 0)
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-gradient-to-br from-brand-light to-subtle">
        {empty}
      </div>
    );

  const arrow =
    'absolute top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-surface/90 p-2 text-fg shadow-float transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand sm:block';
  return (
    <div className="space-y-2">
      <div className="group relative overflow-hidden rounded-2xl bg-subtle">
        <div
          ref={track}
          className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:aspect-[16/10] [&::-webkit-scrollbar]:hidden"
        >
          {shown.map((m, i) => (
            <button
              key={keyOf(m)}
              type="button"
              data-index={i}
              onClick={() => setOpen(i)}
              aria-label={m.type === 'image' ? t('media.preview') : t('media.playVideo')}
              className="relative h-full w-full shrink-0 snap-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
            >
              <Still m={m} onBroken={markBroken(m)} eager={i === 0} />
              {m.type !== 'image' && playBadge}
            </button>
          ))}
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(current - 1)}
              aria-label={t('media.prev')}
              className={clsx(arrow, 'start-3')}
            >
              <ChevronRight className="h-5 w-5 ltr:rotate-180" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(current + 1)}
              aria-label={t('media.next')}
              className={clsx(arrow, 'end-3')}
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden />
            </button>
          </>
        )}
        <div
          className="pointer-events-none absolute bottom-3 end-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-sm font-bold text-white"
          dir="ltr"
        >
          <Expand className="h-3.5 w-3.5" aria-hidden />
          {current + 1} / {count}
        </div>
      </div>

      {count > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {shown.map((m, i) => (
            <button
              key={keyOf(m)}
              type="button"
              onClick={() => go(i)}
              aria-label={t('listing.page.pictureN', { n: i + 1 })}
              aria-current={i === current}
              className={clsx(
                'relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-subtle transition sm:h-20 sm:w-28',
                i === current ? 'border-brand' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <Still m={m} onBroken={markBroken(m)} />
              {m.type !== 'image' && playBadge}
            </button>
          ))}
        </div>
      )}
      <MediaViewer items={shown} index={open} onIndex={setOpen} />
    </div>
  );
}

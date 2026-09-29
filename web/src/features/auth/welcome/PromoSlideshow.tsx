import { useEffect, useState } from 'react';
import clsx from 'clsx';

const SLIDES = Array.from({ length: 17 }, (_, i) => `/promo/${String(i + 1).padStart(2, '0')}.webp`);
const INTERVAL_MS = 4000;

/** Full-viewport cross-fading background copied from the legacy promo splash. */
export default function PromoSlideshow() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % SLIDES.length), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden>
      {SLIDES.map((src, slide) => (
        <img
          key={src}
          src={src}
          alt=""
          loading={slide === 0 ? 'eager' : 'lazy'}
          decoding="async"
          className={clsx(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms]',
            slide === index ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
    </div>
  );
}

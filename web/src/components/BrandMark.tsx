import clsx from 'clsx';

/**
 * The Nitaq logo: four land parcels on top of two layers (the map's layers). Drawn on its own white tile because the
 * gaps between the parcels are white strokes, so it reads the same on every header style and in both themes.
 * `public/icon.svg` is the same drawing for the app icons.
 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx('flex shrink-0 items-center justify-center rounded-xl bg-white p-1', className)}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full">
        <g transform="translate(0 2)" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M32 6 45 12.5 32 19 19 12.5Z" fill="#84cc16" />
          <path d="M45 12.5 58 19 45 25.5 32 19Z" fill="#14b8a6" />
          <path d="M19 12.5 32 19 19 25.5 6 19Z" fill="#0e9f8e" />
          <path d="M32 19 45 25.5 32 32 19 25.5Z" fill="#1d6fb8" />
          <g fill="none" strokeWidth="5.5" strokeLinecap="round">
            <path d="M7 29.5 32 42 57 29.5" stroke="#1769aa" />
            <path d="M7 39.5 32 52 57 39.5" stroke="#0f4c81" />
          </g>
        </g>
      </svg>
    </span>
  );
}

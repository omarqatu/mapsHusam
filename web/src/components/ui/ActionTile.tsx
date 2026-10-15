import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

/**
 * One of a row of equal secondary actions under a listing (map, directions, save, share): the icon over a short
 * label, so four of them fit one phone row with the same size and nothing wraps.
 */
export default function ActionTile({
  icon,
  label,
  className,
  ...rest
}: { icon: ReactNode; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={clsx(
        'flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface px-1 text-xs font-semibold text-fg transition-colors hover:border-brand hover:bg-brand-light/40 focus-visible:outline-2 focus-visible:outline-brand aria-pressed:border-brand aria-pressed:bg-brand-light/40 aria-expanded:border-brand',
        className,
      )}
      {...rest}
    >
      <span className="text-brand-fg [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
        {icon}
      </span>
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

/** The row the tiles sit in: equal columns, as many as fit (at least ~4.5 rem each). */
export function ActionTiles({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-2">{children}</div>;
}

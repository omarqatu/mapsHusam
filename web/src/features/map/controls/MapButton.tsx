import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface MapButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

/** Round floating button used for every on-map control (same size, focus ring, tooltip). */
export default function MapButton({ label, active, className, children, ...rest }: MapButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={clsx(
        'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        active ? 'bg-brand text-white shadow-md' : 'glass text-slate-800 hover:bg-white/90',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

import type { ReactNode } from 'react';
import clsx from 'clsx';

interface DataFieldProps {
  label: string;
  /** Nullable on purpose — renders a muted em-dash when absent. */
  value?: ReactNode;
  /** Monospace value (codes, coordinates, dates). */
  mono?: boolean;
  /** Span two grid columns. */
  wide?: boolean;
  className?: string;
}

/**
 * Read-only labeled value for detail views — the display twin of FormField.
 * Same API as the water platform's DataField (pwa-1 components/ui), so detail screens look alike.
 */
export default function DataField({ label, value, mono, wide, className }: DataFieldProps) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className={clsx(wide && 'col-span-2', className)}>
      <div className="mb-0.5 text-xs text-slate-500">{label}</div>
      <div
        className={clsx(
          'text-sm font-medium break-words',
          mono && 'font-mono',
          empty ? 'text-slate-300' : 'text-slate-900',
        )}
        dir={mono ? 'ltr' : undefined}
      >
        {empty ? '—' : value}
      </div>
    </div>
  );
}

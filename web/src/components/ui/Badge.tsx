import type { ReactNode } from 'react';
import clsx from 'clsx';

export type BadgeTone = 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'slate';

const tones: Record<BadgeTone, string> = {
  green: 'bg-green-50 text-green-800 ring-green-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  blue: 'bg-blue-50 text-blue-800 ring-blue-200',
  purple: 'bg-purple-50 text-purple-800 ring-purple-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};

/** Small status / role pill. Text is always at least 12 px and dark enough on its tint. */
export default function Badge({
  tone = 'slate',
  children,
  className,
  large,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  /** 14 px text for badges that carry content (default 12 px suits table cells). */
  large?: boolean;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 font-bold ring-1 ring-inset',
        large ? 'text-sm' : 'text-xs',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

import type { ReactNode } from 'react';
import clsx from 'clsx';

export type BadgeTone = 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'slate';

const tones: Record<BadgeTone, string> = {
  green: 'bg-ok-soft text-ok ring-ok-line',
  red: 'bg-danger-soft text-danger ring-danger-line',
  amber: 'bg-warn-soft text-warn ring-warn-line',
  blue: 'bg-info-soft text-info ring-info-line',
  purple: 'bg-brand-light text-brand-fg ring-brand/30',
  slate: 'bg-subtle text-fg ring-line',
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

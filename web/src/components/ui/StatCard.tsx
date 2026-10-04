import type { ReactNode } from 'react';
import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  /** Tailwind bg-color-500 class for the icon chip, e.g. 'bg-info-solid'. */
  chipClassName: string;
  /** Tailwind bg-color-50/text-color-700 classes for the card body, e.g. 'bg-info-soft text-info'. */
  tileClassName: string;
  className?: string;
}

/**
 * Compact stat tile: label + icon chip + big number (same API as the water platform's StatCard).
 * Class names must be written out in full by the caller so Tailwind can see them.
 */
export default function StatCard({
  label,
  value,
  icon,
  chipClassName,
  tileClassName,
  className,
}: StatCardProps) {
  return (
    <div className={clsx('rounded-xl p-3', tileClassName, className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium opacity-80">{label}</span>
        <span className={clsx('shrink-0 rounded-lg p-1.5 text-white', chipClassName)} aria-hidden>
          {icon}
        </span>
      </div>
      <div className="text-xl font-black">{value}</div>
    </div>
  );
}

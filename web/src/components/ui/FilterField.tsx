import type { ReactNode } from 'react';
import clsx from 'clsx';

/** Label above a filter control (FormField without the reserved error line — filters have no errors). */
export default function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </div>
  );
}

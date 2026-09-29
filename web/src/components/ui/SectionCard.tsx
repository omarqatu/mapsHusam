import type { ReactNode } from 'react';
import clsx from 'clsx';

interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  /** Optional badge beside the title (e.g. a count chip). */
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Titled card grouping related fields in a detail view (same API as the water platform's SectionCard). */
export default function SectionCard({ title, icon, badge, children, className }: SectionCardProps) {
  return (
    <section
      className={clsx('space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm', className)}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        {icon && <span className="text-brand">{icon}</span>}
        <h4 className="text-base font-bold text-slate-800">{title}</h4>
        {badge}
      </div>
      {children}
    </section>
  );
}

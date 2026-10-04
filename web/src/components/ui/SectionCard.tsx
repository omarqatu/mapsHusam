import type { ReactNode } from 'react';
import clsx from 'clsx';

interface SectionCardProps {
  title: string;
  /** Anchor id (deep links scroll to it). */
  id?: string;
  icon?: ReactNode;
  /** Muted line under the title, e.g. a "last updated" stamp. */
  subtitle?: ReactNode;
  /** Optional badge beside the title (e.g. a count chip). */
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Titled card grouping related fields in a detail view (same API as the water platform's SectionCard). */
export default function SectionCard({
  title,
  id,
  icon,
  subtitle,
  badge,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      id={id}
      className={clsx('space-y-3 rounded-xl border border-line bg-surface p-4 shadow-sm', className)}
    >
      <div className="flex items-center gap-2 border-b border-line pb-2">
        {icon && <span className="text-brand-fg">{icon}</span>}
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-bold text-fg">{title}</h4>
          {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

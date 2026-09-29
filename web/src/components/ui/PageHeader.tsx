import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  /** Filter controls rendered under the title row. */
  filters?: ReactNode;
}

export default function PageHeader({ title, description, icon, actions, filters }: PageHeaderProps) {
  return (
    <div className="mb-6 rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {icon && <div className="rounded-xl bg-brand-light p-3 text-brand">{icon}</div>}
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-black text-slate-800">{title}</h1>
            {description && <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {filters && <div className="border-t border-slate-100 p-4">{filters}</div>}
    </div>
  );
}

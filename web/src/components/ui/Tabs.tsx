import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface TabsProps<T extends string> {
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Prefix of the element ids: tab `${idPrefix}-tab-${id}` controls panel `${idPrefix}-tabpanel-${id}`. */
  idPrefix: string;
  className?: string;
}

/** Segmented tab bar (equal-width). The caller renders the `role="tabpanel"` elements with the matching ids. */
export default function Tabs<T extends string>({ tabs, value, onChange, label, idPrefix, className }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={clsx('grid gap-1 rounded-lg bg-slate-100 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          id={`${idPrefix}-tab-${tab.id}`}
          aria-selected={value === tab.id}
          aria-controls={`${idPrefix}-tabpanel-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-2 text-sm font-semibold',
            value === tab.id ? 'bg-white text-brand shadow-sm' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {tab.icon}
          <span className="truncate">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

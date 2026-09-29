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
  /** Many tabs: natural width each and the bar scrolls sideways instead of squeezing them into equal columns. */
  scrollable?: boolean;
}

/** Segmented tab bar (equal-width). The caller renders the `role="tabpanel"` elements with the matching ids. */
export default function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
  className,
  scrollable,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={clsx(
        'gap-1 rounded-lg bg-slate-100 p-1',
        scrollable ? 'flex overflow-x-auto' : 'grid',
        className,
      )}
      style={scrollable ? undefined : { gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
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
            'flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold',
            scrollable ? 'shrink-0 flex-row whitespace-nowrap' : 'flex-col gap-0.5 px-1',
            value === tab.id ? 'bg-white text-brand shadow-sm' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {tab.icon}
          <span className={scrollable ? undefined : 'truncate'}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';

export const PAGE_SIZE = 20;

interface Props<T> {
  items: T[];
  getKey: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
  pageSize?: number;
}

/**
 * Result cards in a responsive grid, `pageSize` at a time with a "show more" button (legacy rendered every row at once,
 * up to 2000 cards). The parent gives it a `key` that changes with the search, so a new search starts on page one.
 */
export default function PagedGrid<T>({ items, getKey, render, pageSize = PAGE_SIZE }: Props<T>) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(pageSize);
  const visible = items.slice(0, shown);
  const left = items.length - visible.length;
  return (
    <div className="space-y-4">
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((item, i) => (
          <li key={getKey(item)} className="min-w-0">
            {render(item, i)}
          </li>
        ))}
      </ul>
      {left > 0 && (
        <div className="flex flex-col items-center gap-1">
          <Button variant="secondary" size="lg" onClick={() => setShown((n) => n + pageSize)}>
            {t('searchPage.showMore', { count: Math.min(left, pageSize) })}
          </Button>
          <p className="text-sm text-slate-600">
            {t('searchPage.shownOf', { shown: visible.length, total: items.length })}
          </p>
        </div>
      )}
    </div>
  );
}

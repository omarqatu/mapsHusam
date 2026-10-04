import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import Button from './Button';
import EmptyState from './EmptyState';
import { CenteredSpinner } from './Spinner';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Provide to make the column sortable (client-side). */
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  /**
   * Where the column goes when the table turns into cards (below `md`):
   * `title` = the card's heading, `footer` = the action row (no label), `hide` = table only, `wide` = value spans the full card width, default = label + value.
   */
  card?: 'title' | 'footer' | 'hide' | 'wide';
  /** `false` = cards only (e.g. a card heading that sums up several table columns). */
  table?: false;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyTitle?: string;
  /** Client-side page size; omit for no paging. */
  pageSize?: number;
  onRowClick?: (row: T) => void;
  /** Sort applied until the user picks a column. */
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  /** Extra classes of a row / card (e.g. highlight unsaved rows). */
  rowClassName?: (row: T) => string | undefined;
  /**
   * Adds a drag handle column (desktop): dropping row `from` on row `to` calls this. Cards have no handle —
   * put move-up / move-down buttons in a cell instead. Sorting is off while this is set (the order is the data).
   */
  onReorder?: (fromKey: string | number, toKey: string | number) => void;
  /** Accessible name of the table / list. */
  label?: string;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle,
  pageSize,
  onRowClick,
  initialSort,
  rowClassName,
  onReorder,
  label,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  const [picked, setPicked] = useState<{ key: string; dir: 'asc' | 'desc' } | null | undefined>(undefined);
  const sort = onReorder ? null : picked === undefined ? (initialSort ?? null) : picked;
  const [page, setPage] = useState(1);
  const dragKey = useRef<string | number | null>(null);
  const [overKey, setOverKey] = useState<string | number | null>(null);

  const tableColumns = columns.filter((c) => c.table !== false);
  const sorted = useMemo(() => {
    const data = rows ?? [];
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col?.sortValue) return data;
    const get = col.sortValue;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = get(a) ?? '';
      const bv = get(b) ?? '';
      return (
        (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) *
        factor
      );
    });
  }, [rows, sort, columns]);

  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pages);
  const visible = pageSize ? sorted.slice((current - 1) * pageSize, current * pageSize) : sorted;

  if (loading) return <CenteredSpinner />;
  if (!sorted.length) return <EmptyState title={emptyTitle ?? t('common.noData')} />;

  const toggleSort = (key: string) =>
    setPicked(sort?.key === key ? (sort.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' });

  // A clickable row is a pointer target and also reachable by keyboard (Tab + Enter); keys pressed inside a
  // control in the row (buttons, links) stay with that control.
  const rowActivation = (row: T) =>
    onRowClick
      ? {
          onClick: () => onRowClick(row),
          tabIndex: 0,
          onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
            if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row);
          },
        }
      : {};

  const pager = pageSize && pages > 1 && (
    <div className="flex items-center justify-between gap-2 border-t border-line p-3 text-sm text-muted">
      <Button size="sm" variant="secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>
        {t('common.previous')}
      </Button>
      <span>{t('common.page', { page: current, pages })}</span>
      <Button size="sm" variant="secondary" disabled={current >= pages} onClick={() => setPage(current + 1)}>
        {t('common.next')}
      </Button>
    </div>
  );

  if (!desktop) {
    const cardCols = columns.filter((c) => c.card !== 'hide');
    const titleCol = cardCols.find((c) => c.card === 'title');
    const footerCol = cardCols.find((c) => c.card === 'footer');
    const bodyCols = cardCols.filter((c) => c !== titleCol && c !== footerCol);
    return (
      <div>
        <ul aria-label={label} className="space-y-3">
          {visible.map((row) => (
            <li
              key={rowKey(row)}
              {...rowActivation(row)}
              className={clsx(
                'rounded-2xl border border-line bg-surface p-4 shadow-sm',
                onRowClick && 'cursor-pointer',
                rowClassName?.(row),
              )}
            >
              {titleCol && <div className="mb-3 font-semibold text-fg">{titleCol.cell(row)}</div>}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {bodyCols.map((c) => (
                  <div key={c.key} className={clsx('min-w-0', c.card === 'wide' && 'col-span-2')}>
                    <dt className="text-xs font-semibold text-muted">{c.header}</dt>
                    <dd className="mt-0.5 break-words text-fg">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
              {footerCol && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {footerCol.cell(row)}
                </div>
              )}
            </li>
          ))}
        </ul>
        {pager && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">{pager}</div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table aria-label={label} className="w-full text-start text-sm">
          <thead className="bg-subtle text-muted">
            <tr>
              {onReorder && <th scope="col" className="w-8 px-2 py-3" aria-label={t('common.reorder')} />}
              {tableColumns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={clsx('px-4 py-3 text-start font-semibold', c.className)}
                  >
                    {c.sortValue && !onReorder ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-fg"
                      >
                        {c.header}
                        {active ? (
                          sort.dir === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  {...rowActivation(row)}
                  onDragOver={
                    onReorder
                      ? (e) => {
                          if (dragKey.current === null) return;
                          e.preventDefault();
                          setOverKey(key);
                        }
                      : undefined
                  }
                  onDrop={
                    onReorder
                      ? (e) => {
                          e.preventDefault();
                          const from = dragKey.current;
                          dragKey.current = null;
                          setOverKey(null);
                          if (from !== null && from !== key) onReorder(from, key);
                        }
                      : undefined
                  }
                  className={clsx(
                    onRowClick && 'cursor-pointer hover:bg-subtle',
                    onReorder && overKey === key && 'bg-brand-light',
                    rowClassName?.(row),
                  )}
                >
                  {onReorder && (
                    <td className="w-8 px-2 py-3 align-middle">
                      <span
                        draggable
                        onDragStart={(e) => {
                          dragKey.current = key;
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(key));
                        }}
                        onDragEnd={() => {
                          dragKey.current = null;
                          setOverKey(null);
                        }}
                        className="inline-flex cursor-grab text-muted active:cursor-grabbing"
                        aria-hidden
                      >
                        <GripVertical className="h-5 w-5" />
                      </span>
                    </td>
                  )}
                  {tableColumns.map((c) => (
                    <td key={c.key} className={clsx('px-4 py-3 align-middle', c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pager}
    </div>
  );
}

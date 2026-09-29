import { useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle,
  pageSize,
  onRowClick,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);

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
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={clsx('px-4 py-3 text-start font-semibold', c.className)}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
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
          <tbody className="divide-y divide-slate-100">
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick && (() => onRowClick(row))}
                className={clsx(onRowClick && 'cursor-pointer hover:bg-slate-50')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={clsx('px-4 py-3 align-middle', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageSize && pages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-3 text-sm text-slate-600">
          <Button size="sm" variant="secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            {t('common.previous')}
          </Button>
          <span>{t('common.page', { page: current, pages })}</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  );
}

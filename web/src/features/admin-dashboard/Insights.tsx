import clsx from 'clsx';
import { CheckCircle2, Clock, ListOrdered, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DayCount, StatusKey, TopEntry } from './model';

const STATUS_ORDER: StatusKey[] = ['success', 'pending', 'cancelled'];
const BAR: Record<StatusKey, string> = {
  success: 'bg-ok-solid',
  pending: 'bg-warn-solid',
  cancelled: 'bg-danger-solid',
};
const TILE: Record<StatusKey | 'all', { icon: typeof ListOrdered; tone: string; active: string }> = {
  all: { icon: ListOrdered, tone: 'text-fg', active: 'ring-brand' },
  success: { icon: CheckCircle2, tone: 'text-ok', active: 'ring-ok-solid' },
  pending: { icon: Clock, tone: 'text-warn', active: 'ring-warn-solid' },
  cancelled: { icon: XCircle, tone: 'text-danger', active: 'ring-danger-solid' },
};

/**
 * The four totals of the rows shown. They double as the status filter: a tile shows only its status, "all" clears it.
 */
export function StatusTiles({
  counts,
  total,
  rate,
  status,
  onStatus,
}: {
  counts: Record<StatusKey, number>;
  total: number;
  rate: number;
  status: '' | StatusKey;
  onStatus: (s: '' | StatusKey) => void;
}) {
  const { t } = useTranslation();
  const tiles: { id: '' | StatusKey; label: string; value: number; note?: string }[] = [
    { id: '', label: t('adminDashboard.stat.total'), value: total },
    {
      id: 'success',
      label: t('adminDashboard.status.success'),
      value: counts.success,
      note: t('adminDashboard.stat.rate', { rate }),
    },
    { id: 'pending', label: t('adminDashboard.status.pending'), value: counts.pending },
    { id: 'cancelled', label: t('adminDashboard.status.cancelled'), value: counts.cancelled },
  ];
  return (
    <div
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      role="group"
      aria-label={t('adminDashboard.col.status')}
    >
      {tiles.map(({ id, label, value, note }) => {
        const look = TILE[id || 'all'];
        const Icon = look.icon;
        const active = status === id;
        return (
          <button
            key={id || 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onStatus(active && id ? '' : id)}
            className={clsx(
              'flex min-h-24 flex-col justify-between rounded-2xl border border-line bg-surface p-4 text-start shadow-sm transition',
              'hover:border-line-strong focus-visible:outline-2 focus-visible:outline-brand',
              active && clsx('ring-2', look.active),
            )}
          >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold text-muted">
              {label}
              <Icon className={clsx('h-5 w-5', look.tone)} aria-hidden />
            </span>
            <span className="flex items-baseline gap-2">
              <span className={clsx('text-3xl font-black tabular-nums', look.tone)}>{value}</span>
              {note && <span className="text-sm font-semibold text-muted">{note}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Rows per day for the last days, stacked by status (no chart library: one flex column per day). */
export function TrendChart({ days }: { days: DayCount[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...days.map((d) => d.success + d.pending + d.cancelled));
  // `d/m` with the same Western digits as the dates in the list
  const dayLabel = (day: string) => {
    const [, m, d] = day.split('-');
    return `${Number(d)}/${Number(m)}`;
  };
  const total = days.reduce((n, d) => n + d.success + d.pending + d.cancelled, 0);
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-fg">
          {t('adminDashboard.insights.trend', { days: days.length })}
        </h2>
        <ul className="flex gap-3 text-xs text-muted">
          {STATUS_ORDER.map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5">
              <span className={clsx('h-2.5 w-2.5 rounded-sm', BAR[s])} aria-hidden />
              {t(`adminDashboard.status.${s}`)}
            </li>
          ))}
        </ul>
      </div>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{t('adminDashboard.insights.noRecent')}</p>
      ) : (
        <ol
          className="flex h-40 items-end gap-1"
          aria-label={t('adminDashboard.insights.trend', { days: days.length })}
        >
          {days.map((d, i) => {
            const sum = d.success + d.pending + d.cancelled;
            const label = `${dayLabel(d.day)}: ${STATUS_ORDER.map(
              (s) => `${t(`adminDashboard.status.${s}`)} ${d[s]}`,
            ).join('، ')}`;
            return (
              <li
                key={d.day}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                title={label}
              >
                <span className="sr-only">{label}</span>
                {sum > 0 && <span className="text-[11px] font-bold text-muted tabular-nums">{sum}</span>}
                <span
                  className="flex w-full max-w-8 flex-col-reverse overflow-hidden rounded-md bg-subtle"
                  style={{ height: `${Math.max(sum ? 6 : 2, (sum / max) * 100)}%` }}
                  aria-hidden
                >
                  {STATUS_ORDER.map((s) =>
                    d[s] ? (
                      <span key={s} className={BAR[s]} style={{ height: `${(d[s] / sum) * 100}%` }} />
                    ) : null,
                  )}
                </span>
                {/* phones: every other day, newest included, so the labels fit */}
                <span
                  className={clsx(
                    'text-[11px] text-muted tabular-nums',
                    (days.length - 1 - i) % 2 === 1 && 'invisible sm:visible',
                  )}
                  aria-hidden
                >
                  {dayLabel(d.day)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** A ranked list with a bar per entry (total) and the successful share inside it. */
export function TopList({
  title,
  entries,
  label,
  onPick,
}: {
  title: string;
  entries: TopEntry[];
  label: (key: string) => string;
  /** Clicking an entry filters the table to it. */
  onPick: (key: string) => void;
}) {
  const { t } = useTranslation();
  const max = Math.max(1, ...entries.map((e) => e.total));
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-base font-bold text-fg">{title}</h2>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{t('adminDashboard.insights.noRecent')}</p>
      ) : (
        <ol className="space-y-2.5">
          {entries.map((e) => (
            <li key={e.key}>
              <button
                type="button"
                onClick={() => onPick(e.key)}
                className="block w-full rounded-lg text-start focus-visible:outline-2 focus-visible:outline-brand"
                title={t('adminDashboard.insights.filterBy', { name: label(e.key) })}
              >
                <span className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-semibold text-fg">{label(e.key)}</span>
                  <span className="shrink-0 text-muted tabular-nums">
                    {t('adminDashboard.insights.successOf', { success: e.success, total: e.total })}
                  </span>
                </span>
                <span className="block h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
                  <span
                    className="flex h-full rounded-full bg-brand/25"
                    style={{ width: `${(e.total / max) * 100}%` }}
                  >
                    <span
                      className="h-full rounded-full bg-ok-solid"
                      style={{ width: `${(e.success / e.total) * 100}%` }}
                    />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

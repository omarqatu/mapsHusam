import { useMemo, useState } from 'react';
import { ClipboardList, Handshake, MessageCircle, Phone, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataTable, { type Column } from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/toastStore';
import { errorText } from '@/lib/errorText';
import { formatDateTime } from '@/lib/format';
import { serviceLabelKey } from '@/features/map/registry';
import StatsFilters from './StatsFilters';
import { StatusTiles, TopList, TrendChart } from './Insights';
import { useDeleteStat, useSuccessStats } from './hooks/useSuccessStats';
import {
  countByStatus,
  dailyCounts,
  distinct,
  filterRows,
  hasStatFilters,
  NO_STAT_FILTERS,
  successRate,
  topBy,
  type ContactKey,
  type StatFilters,
  type StatRow,
  type StatusKey,
} from './model';

const statusTone: Record<StatusKey, BadgeTone> = { success: 'green', pending: 'amber', cancelled: 'red' };
const contactIcon: Record<ContactKey, typeof Phone> = {
  call: Phone,
  whatsapp: MessageCircle,
  service_request: ClipboardList,
};
const TREND_DAYS = 14;

/**
 * `/admin/dashboard` — every service request / call / WhatsApp click with its outcome (legacy dashboard.html): totals that
 * filter by status, the last two weeks, the busiest providers and services, then the filterable, deletable list.
 */
export default function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const stats = useSuccessStats();
  const del = useDeleteStat();
  const [filters, setFilters] = useState<StatFilters>(NO_STAT_FILTERS);
  const [toDelete, setToDelete] = useState<StatRow | null>(null);

  const all = useMemo(() => stats.data ?? [], [stats.data]);
  // Everything but the status: the tiles count these, and picking a tile narrows the list to its status.
  const base = useMemo(() => filterRows(all, { ...filters, status: '' }), [all, filters]);
  const shown = useMemo(
    () => (filters.status ? base.filter((r) => r.status === filters.status) : base),
    [base, filters.status],
  );
  const counts = useMemo(() => countByStatus(base), [base]);
  const days = useMemo(() => dailyCounts(base, TREND_DAYS), [base]);
  const topProviders = useMemo(() => topBy(base, 'provider', 5), [base]);
  const topLayers = useMemo(() => topBy(base, 'layer', 5), [base]);

  const layerLabel = (key: string) =>
    t([serviceLabelKey(key), `adminDashboard.extraLayers.${key}`], key || '—');
  const layerOptions = useMemo(
    () => distinct(all, 'layer').map((k) => ({ value: k, label: layerLabel(k) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layerLabel only depends on t
    [all, t],
  );

  const columns = useMemo<Column<StatRow>[]>(() => {
    const dash = <span className="text-muted">—</span>;
    const when = (r: StatRow) => (r.date ? formatDateTime(r.date, i18n.language) : '');
    const contact = (r: StatRow) => {
      const Icon = contactIcon[r.contact];
      return (
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Icon className="h-4 w-4" aria-hidden />
          {t(`adminDashboard.contact.${r.contact}`)}
        </span>
      );
    };
    const status = (r: StatRow) => (
      <Badge tone={statusTone[r.status]}>{t(`adminDashboard.status.${r.status}`)}</Badge>
    );
    return [
      {
        // phones: one compact card per row
        key: 'card',
        header: t('adminDashboard.col.user'),
        card: 'title',
        table: false,
        cell: (r) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 font-bold text-fg">
                {r.username || '—'}
                <span className="font-normal text-muted"> ← </span>
                {r.provider || '—'}
              </p>
              {status(r)}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-normal text-muted">
              <span className="font-semibold text-info">{layerLabel(r.layer)}</span>
              {contact(r)}
              <span className="tabular-nums">{when(r)}</span>
            </p>
            {r.reason && (
              <p className="text-sm font-normal text-fg">
                {t('adminDashboard.reasonLine', { reason: r.reason })}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'who',
        header: t('adminDashboard.col.who'),
        card: 'hide',
        sortValue: (r) => r.username,
        cell: (r) => (
          <div className="min-w-0">
            <p className="font-bold text-fg">{r.username || '—'}</p>
            <p className="text-xs text-muted">
              {t('adminDashboard.toProvider', { name: r.provider || '—' })}
            </p>
            {r.phone && (
              <p className="text-xs text-muted tabular-nums">
                <bdi dir="ltr">{r.phone}</bdi>
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'service',
        header: t('adminDashboard.col.layer'),
        card: 'hide',
        sortValue: (r) => layerLabel(r.layer),
        cell: (r) => (
          <div className="space-y-0.5">
            <p className="font-semibold text-fg">{layerLabel(r.layer)}</p>
            <p className="text-xs">{contact(r)}</p>
          </div>
        ),
      },
      {
        key: 'date',
        header: t('adminDashboard.col.date'),
        card: 'hide',
        sortValue: (r) => r.date ?? '',
        cell: (r) =>
          r.date ? <span className="whitespace-nowrap tabular-nums text-muted">{when(r)}</span> : dash,
      },
      {
        key: 'status',
        header: t('adminDashboard.col.status'),
        card: 'hide',
        sortValue: (r) => r.status,
        cell: status,
      },
      {
        key: 'reason',
        header: t('adminDashboard.col.reason'),
        card: 'hide',
        className: 'max-w-56',
        cell: (r) =>
          r.reason ? (
            <span className="line-clamp-2 text-muted" title={r.reason}>
              {r.reason}
            </span>
          ) : (
            dash
          ),
      },
      {
        key: 'actions',
        header: '',
        card: 'footer',
        className: 'w-12',
        cell: (r) => (
          <button
            type="button"
            title={t('common.delete')}
            aria-label={t('adminDashboard.delete.aria', { id: r.id })}
            onClick={() => setToDelete(r)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layerLabel only depends on t
  }, [t, i18n.language]);

  const confirmDelete = () => {
    if (!toDelete) return;
    del.mutate(toDelete.id, {
      onSuccess: () => toast.success(t('adminDashboard.delete.done')),
      onError: (e) => toast.error(errorText(e, t('adminDashboard.delete.failed'))),
      onSettled: () => setToDelete(null),
    });
  };

  return (
    <>
      <PageHeader
        title={t('adminDashboard.title')}
        description={t('adminDashboard.subtitle')}
        icon={<Handshake className="h-6 w-6" aria-hidden />}
        actions={
          <Button
            variant="secondary"
            startIcon={<RefreshCw className={stats.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
            onClick={() => void stats.refetch()}
            disabled={stats.isFetching}
          >
            {t('adminDashboard.reload')}
          </Button>
        }
      />

      {stats.isError ? (
        <AlertMessage type="error" message={errorText(stats.error, t('adminDashboard.loadFailed'))} />
      ) : (
        <div className="space-y-4">
          <StatusTiles
            counts={counts}
            total={base.length}
            rate={successRate(counts)}
            status={filters.status}
            onStatus={(status) => setFilters({ ...filters, status })}
          />

          <div className="grid gap-4 lg:grid-cols-4 [&>*]:min-w-0">
            <div className="lg:col-span-2">
              <TrendChart days={days} />
            </div>
            <TopList
              title={t('adminDashboard.insights.topProviders')}
              entries={topProviders}
              label={(k) => k}
              onPick={(k) => setFilters({ ...filters, providerExact: k })}
            />
            <TopList
              title={t('adminDashboard.insights.topServices')}
              entries={topLayers}
              label={layerLabel}
              onPick={(k) => setFilters({ ...filters, layer: k })}
            />
          </div>

          <section className="rounded-2xl border border-line bg-surface p-3 shadow-sm md:p-4">
            <StatsFilters
              value={filters}
              onChange={setFilters}
              users={distinct(all, 'username')}
              providers={distinct(all, 'provider')}
              reasons={distinct(all, 'reason')}
              layers={layerOptions}
            />
          </section>

          <p className="text-sm font-semibold text-fg" aria-live="polite">
            {hasStatFilters(filters)
              ? t('adminDashboard.shownOf', { shown: shown.length, total: all.length })
              : t('adminDashboard.total', { count: all.length })}
          </p>
          <DataTable
            label={t('adminDashboard.title')}
            columns={columns}
            rows={shown}
            rowKey={(r) => r.id}
            loading={stats.isLoading}
            emptyTitle={hasStatFilters(filters) ? t('adminDashboard.noMatch') : t('adminDashboard.empty')}
            pageSize={25}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t('adminDashboard.delete.title')}
        message={t('adminDashboard.delete.message')}
        tone="danger"
        confirmLabel={t('common.delete')}
        loading={del.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

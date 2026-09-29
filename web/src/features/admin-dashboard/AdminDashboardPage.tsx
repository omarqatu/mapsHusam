import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock,
  Handshake,
  MessageCircle,
  Phone,
  RefreshCw,
  Trash2,
  UserCog,
  XCircle,
  Zap,
  ListOrdered,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataTable, { type Column } from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { toast } from '@/components/ui/toastStore';
import { errorText } from '@/lib/errorText';
import { formatDateTime } from '@/lib/format';
import StatsFilters from './StatsFilters';
import { useDeleteStat, useSuccessStats } from './hooks/useSuccessStats';
import {
  countByStatus,
  distinct,
  filterRows,
  hasStatFilters,
  NO_STAT_FILTERS,
  type ContactKey,
  type StatFilters,
  type StatRow,
  type StatusKey,
} from './model';
import { serviceLabelKey } from '@/features/map/registry';

const statusTone: Record<StatusKey, BadgeTone> = { success: 'green', pending: 'amber', cancelled: 'red' };
const contactIcon: Record<ContactKey, typeof Phone> = {
  call: Phone,
  whatsapp: MessageCircle,
  service_request: ClipboardList,
};

const linkBtn =
  'inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 font-semibold text-fg hover:bg-subtle';

/** `/admin/dashboard` — every service request / call / WhatsApp click with its outcome, filterable, deletable (legacy dashboard.html). */
export default function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const stats = useSuccessStats();
  const del = useDeleteStat();
  const [filters, setFilters] = useState<StatFilters>(NO_STAT_FILTERS);
  const [toDelete, setToDelete] = useState<StatRow | null>(null);

  const all = useMemo(() => stats.data ?? [], [stats.data]);
  const shown = useMemo(() => filterRows(all, filters), [all, filters]);
  const counts = useMemo(() => countByStatus(shown), [shown]);
  const layerLabel = (key: string) =>
    t([serviceLabelKey(key), `adminDashboard.extraLayers.${key}`], key || '—');
  const layerOptions = useMemo(
    () => distinct(all, 'layer').map((k) => ({ value: k, label: layerLabel(k) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layerLabel only depends on t
    [all, t],
  );

  const columns = useMemo<Column<StatRow>[]>(() => {
    const dash = <span className="text-muted">—</span>;
    return [
      {
        key: 'user',
        header: t('adminDashboard.col.user'),
        card: 'title',
        cell: (r) => <strong className="text-fg">{r.username || '—'}</strong>,
      },
      {
        key: 'provider',
        header: t('adminDashboard.col.provider'),
        cell: (r) => <strong>{r.provider || '—'}</strong>,
      },
      {
        key: 'layer',
        header: t('adminDashboard.col.layer'),
        cell: (r) => <span className="font-semibold text-info">{layerLabel(r.layer)}</span>,
      },
      {
        key: 'phone',
        header: t('adminDashboard.col.phone'),
        cell: (r) => (r.phone ? <bdi>{r.phone}</bdi> : dash),
      },
      {
        key: 'date',
        header: t('adminDashboard.col.date'),
        cell: (r) =>
          r.date ? <span className="whitespace-nowrap">{formatDateTime(r.date, i18n.language)}</span> : dash,
      },
      {
        key: 'contact',
        header: t('adminDashboard.col.contact'),
        cell: (r) => {
          const Icon = contactIcon[r.contact];
          return (
            <span className="inline-flex items-center gap-1.5">
              <Icon className="h-4 w-4 text-muted" aria-hidden />
              {t(`adminDashboard.contact.${r.contact}`)}
            </span>
          );
        },
      },
      {
        key: 'status',
        header: t('adminDashboard.col.status'),
        cell: (r) => <Badge tone={statusTone[r.status]}>{t(`adminDashboard.status.${r.status}`)}</Badge>,
      },
      { key: 'reason', header: t('adminDashboard.col.reason'), cell: (r) => r.reason || dash },
      {
        key: 'actions',
        header: t('common.actions'),
        card: 'footer',
        cell: (r) => (
          <Button
            variant="dangerSoft"
            size="sm"
            startIcon={<Trash2 className="h-4 w-4" />}
            aria-label={t('adminDashboard.delete.aria', { id: r.id })}
            onClick={() => setToDelete(r)}
          >
            {t('common.delete')}
          </Button>
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
          <>
            <Button
              variant="secondary"
              startIcon={<RefreshCw className={stats.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              onClick={() => void stats.refetch()}
              disabled={stats.isFetching}
            >
              {t('adminDashboard.reload')}
            </Button>
            <Link to="/notifications" className={linkBtn}>
              <Bell className="h-4 w-4" aria-hidden />
              {t('adminDashboard.links.notifications')}
            </Link>
            <Link to="/admin/widgets" className={linkBtn}>
              <Zap className="h-4 w-4" aria-hidden />
              {t('adminDashboard.links.widgets')}
            </Link>
            <Link to="/admin/users" className={linkBtn}>
              <UserCog className="h-4 w-4" aria-hidden />
              {t('adminDashboard.links.users')}
            </Link>
          </>
        }
        filters={
          <StatsFilters
            value={filters}
            onChange={setFilters}
            users={distinct(all, 'username')}
            providers={distinct(all, 'provider')}
            reasons={distinct(all, 'reason')}
            layers={layerOptions}
          />
        }
      />

      {stats.isError ? (
        <AlertMessage type="error" message={errorText(stats.error, t('adminDashboard.loadFailed'))} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={t('adminDashboard.stat.total')}
              value={shown.length}
              icon={<ListOrdered className="h-4 w-4" />}
              chipClassName="bg-subtle-2"
              tileClassName="bg-subtle text-fg"
            />
            <StatCard
              label={t('adminDashboard.status.success')}
              value={counts.success}
              icon={<CheckCircle2 className="h-4 w-4" />}
              chipClassName="bg-ok-solid"
              tileClassName="bg-ok-soft text-ok"
            />
            <StatCard
              label={t('adminDashboard.status.pending')}
              value={counts.pending}
              icon={<Clock className="h-4 w-4" />}
              chipClassName="bg-warn-solid"
              tileClassName="bg-warn-soft text-warn"
            />
            <StatCard
              label={t('adminDashboard.status.cancelled')}
              value={counts.cancelled}
              icon={<XCircle className="h-4 w-4" />}
              chipClassName="bg-danger-solid"
              tileClassName="bg-danger-soft text-danger"
            />
          </div>
          <p className="mb-3 text-sm font-semibold text-fg">
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
        </>
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

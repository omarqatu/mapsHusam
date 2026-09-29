import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Ban, CheckCircle2, Eye, LogOut, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminUser } from '@/api/adminUsers';
import Badge from '@/components/ui/Badge';
import Checkbox from '@/components/ui/Checkbox';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusDot from '@/components/ui/StatusDot';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { formatDateTime } from '@/lib/format';
import { parseServerDate } from '../model';

interface Props {
  users: AdminUser[] | undefined;
  loading: boolean;
  onlineIds: ReadonlySet<string>;
  selected: ReadonlySet<number>;
  /** The signed-in admin: their own row can't be deactivated or logged out from here. */
  meId: number | undefined;
  emptyTitle: string;
  onToggleSelect: (id: number, on: boolean) => void;
  onEdit: (u: AdminUser) => void;
  onToggleActive: (u: AdminUser) => void;
  onForceLogout: (u: AdminUser) => void;
}

const roleTone = { admin: 'red', provider: 'blue', user: 'green' } as const;

const iconBtn =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-sm font-semibold transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50';

function Action({
  label,
  showLabel,
  tone,
  children,
  ...rest
}: {
  label: string;
  showLabel: boolean;
  tone: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={rest.title ?? label}
      className={`${iconBtn} ${tone}`}
      {...rest}
    >
      {children}
      {showLabel && <span>{label}</span>}
    </button>
  );
}

/** The users list: a table from `md` up, one card per user on phones (same cells, same actions). */
export default function UsersTable({
  users,
  loading,
  onlineIds,
  selected,
  meId,
  emptyTitle,
  onToggleSelect,
  onEdit,
  onToggleActive,
  onForceLogout,
}: Props) {
  const { t, i18n } = useTranslation();
  const desktop = useIsDesktop();

  const columns = useMemo<Column<AdminUser>[]>(() => {
    const isSelf = (u: AdminUser) => u.user_id === meId;
    const quota = (u: AdminUser) =>
      u.request_limit ? (
        <span>
          <strong className="text-warn">{u.request_limit}</strong>{' '}
          <span className="text-muted">
            / {t(`adminUsers.period.${u.request_limit_period ?? 'daily'}`)}
          </span>
        </span>
      ) : (
        <span className="font-semibold text-ok">{t('adminUsers.unlimited')}</span>
      );

    return [
      {
        key: 'select',
        header: t('adminUsers.col.select'),
        card: 'hide',
        className: 'w-10',
        cell: (u) => (
          <Checkbox
            aria-label={t('adminUsers.selectUser', { name: u.full_name || u.user_id })}
            checked={selected.has(u.user_id)}
            onChange={(on) => onToggleSelect(u.user_id, on)}
          />
        ),
      },
      {
        key: 'user',
        header: t('adminUsers.col.user'),
        card: 'title',
        sortValue: (u) => (u.full_name ?? '').toLowerCase(),
        cell: (u) => (
          <div className="flex min-w-0 items-start gap-3">
            {!desktop && (
              <Checkbox
                aria-label={t('adminUsers.selectUser', { name: u.full_name || u.user_id })}
                checked={selected.has(u.user_id)}
                onChange={(on) => onToggleSelect(u.user_id, on)}
              />
            )}
            <div className="min-w-0 space-y-0.5">
              <div className="font-bold text-fg">{u.full_name || t('adminUsers.noName')}</div>
              {u.phone && (
                <div className="text-fg">
                  <bdi>{u.phone}</bdi>
                </div>
              )}
              {u.email && (
                <div className="break-all text-fg">
                  <bdi>{u.email}</bdi>
                </div>
              )}
              <div className="text-xs font-medium text-muted">ID {u.user_id}</div>
            </div>
          </div>
        ),
      },
      {
        key: 'role',
        header: t('adminUsers.col.role'),
        sortValue: (u) => u.role,
        cell: (u) => <Badge tone={roleTone[u.role] ?? 'slate'}>{t(`roles.${u.role}`, u.role)}</Badge>,
      },
      {
        key: 'status',
        header: t('adminUsers.col.status'),
        sortValue: (u) => (u.is_active ? 1 : 0),
        cell: (u) => {
          const online = onlineIds.has(String(u.user_id));
          return (
            <div className="flex flex-col items-start gap-1.5">
              <Badge tone={u.is_active ? 'green' : 'red'}>
                {u.is_active ? t('adminUsers.active') : t('adminUsers.inactive')}
              </Badge>
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${online ? 'text-ok' : 'text-muted'}`}
              >
                <StatusDot color={online ? 'var(--color-ok-solid)' : 'var(--color-line-strong)'} />
                {online ? t('adminUsers.online') : t('adminUsers.offline')}
              </span>
            </div>
          );
        },
      },
      {
        key: 'service',
        header: t('adminUsers.col.service'),
        sortValue: (u) => u.service_layer ?? '',
        cell: (u) =>
          u.service_layer ? (
            <div>
              <div className="font-semibold text-info">
                {t(`services.${u.service_layer}`, u.service_layer)}
              </div>
              <div className="text-xs font-medium text-muted">
                {t('adminUsers.featureShort')} {u.feature_id ?? '—'}
              </div>
            </div>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      { key: 'quota', header: t('adminUsers.col.quota'), cell: quota },
      {
        key: 'created',
        header: t('adminUsers.col.created'),
        sortValue: (u) => parseServerDate(u.created_at)?.getTime() ?? 0,
        cell: (u) => {
          const d = parseServerDate(u.created_at);
          return d ? <span className="whitespace-nowrap">{formatDateTime(d, i18n.language)}</span> : '—';
        },
      },
      {
        key: 'actions',
        header: t('common.actions'),
        card: 'footer',
        cell: (u) => {
          const self = isSelf(u);
          const selfTitle = t('adminUsers.selfLocked');
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                to={`/admin/users/${u.user_id}/view`}
                aria-label={t('adminUsers.actions.view')}
                title={t('adminUsers.actions.viewHint')}
                className={`${iconBtn} border-ok-line bg-ok-soft text-ok hover:bg-ok-soft`}
              >
                <Eye className="h-4 w-4" aria-hidden />
                {!desktop && <span>{t('adminUsers.actions.view')}</span>}
              </Link>
              <Action
                label={t('adminUsers.actions.edit')}
                showLabel={!desktop}
                tone="border-info-line bg-info-soft text-info hover:bg-info-soft"
                onClick={() => onEdit(u)}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </Action>
              <Action
                label={u.is_active ? t('adminUsers.actions.deactivate') : t('adminUsers.actions.activate')}
                showLabel={!desktop}
                tone={
                  u.is_active
                    ? 'border-warn-line bg-warn-soft text-warn hover:bg-warn-soft'
                    : 'border-ok-line bg-ok-soft text-ok hover:bg-ok-soft'
                }
                disabled={self && u.is_active}
                title={self && u.is_active ? selfTitle : undefined}
                onClick={() => onToggleActive(u)}
              >
                {u.is_active ? (
                  <Ban className="h-4 w-4" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                )}
              </Action>
              <Action
                label={t('adminUsers.actions.forceLogout')}
                showLabel={!desktop}
                tone="border-danger-line bg-danger-soft text-danger hover:bg-danger-soft"
                disabled={self}
                title={self ? selfTitle : t('adminUsers.actions.forceLogoutHint')}
                onClick={() => onForceLogout(u)}
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </Action>
            </div>
          );
        },
      },
    ];
  }, [
    t,
    i18n.language,
    desktop,
    meId,
    selected,
    onlineIds,
    onToggleSelect,
    onEdit,
    onToggleActive,
    onForceLogout,
  ]);

  return (
    <DataTable
      label={t('adminUsers.title')}
      columns={columns}
      rows={users}
      rowKey={(u) => u.user_id}
      loading={loading}
      emptyTitle={emptyTitle}
      pageSize={25}
    />
  );
}

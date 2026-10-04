import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LayoutDashboard, RefreshCw, UserCog, UserX, Users, Wifi, WifiOff, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminUser, LogoutTarget } from '@/api/adminUsers';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/toastStore';
import { errorText } from '@/lib/errorText';
import { useAuthStore } from '@/store/authStore';
import EditUserDialog from './components/EditUserDialog';
import UserFiltersBar from './components/UserFilters';
import UsersTable from './components/UsersTable';
import {
  useAdminUsers,
  useForceLogout,
  useForceLogoutAll,
  useOnlineIds,
  useUpdateUser,
} from './hooks/useAdminUsers';
import { filterUsers, hasFilters, newestFirst, NO_FILTERS, type UserFilters } from './model';

type Pending =
  | { kind: 'toggle'; user: AdminUser }
  | { kind: 'logout'; user: AdminUser }
  | { kind: 'bulk'; target: LogoutTarget };

/** `/admin/users` — accounts: find, activate, change role / service link / quota / password, force log-out (legacy admin-users.html). */
export default function AdminUsersPage() {
  const { t } = useTranslation();
  const meId = useAuthStore((s) => s.user?.user_id);
  const users = useAdminUsers();
  const onlineIds = useOnlineIds(users.isSuccess);
  const [filters, setFilters] = useState<UserFilters>(NO_FILTERS);
  // Kept apart from the filters on purpose: a selection survives changing the filter (legacy fix).
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const update = useUpdateUser();
  const forceLogout = useForceLogout();
  const forceLogoutAll = useForceLogoutAll();
  const busy = update.isPending || forceLogout.isPending || forceLogoutAll.isPending;

  const shown = useMemo(
    () => filterUsers(users.data ?? [], filters, onlineIds).sort(newestFirst),
    [users.data, filters, onlineIds],
  );
  const selectedShown = shown.filter((u) => selected.has(u.user_id)).length;

  const toggleSelect = useCallback((id: number, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const toggleAllShown = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      shown.forEach((u) => (on ? next.add(u.user_id) : next.delete(u.user_id)));
      return next;
    });

  const openEdit = useCallback((u: AdminUser) => setEditing(u), []);
  const askToggle = useCallback((u: AdminUser) => setPending({ kind: 'toggle', user: u }), []);
  const askLogout = useCallback((u: AdminUser) => setPending({ kind: 'logout', user: u }), []);

  const fail = (e: unknown) => toast.error(errorText(e, t('errors.generic')));

  const confirm = () => {
    if (!pending) return;
    const done = () => setPending(null);
    if (pending.kind === 'toggle') {
      const activate = !pending.user.is_active;
      update.mutate(
        { user_id: pending.user.user_id, is_active: activate },
        {
          onSuccess: () =>
            toast.success(t(activate ? 'adminUsers.toast.activated' : 'adminUsers.toast.deactivated')),
          onError: fail,
          onSettled: done,
        },
      );
    } else if (pending.kind === 'logout') {
      forceLogout.mutate(pending.user.user_id, {
        onSuccess: (r) =>
          toast.success(
            t(r.wasOnline ? 'adminUsers.toast.loggedOutOnline' : 'adminUsers.toast.loggedOutOffline'),
          ),
        onError: fail,
        onSettled: done,
      });
    } else {
      const ids = pending.target === 'selected' ? [...selected] : undefined;
      forceLogoutAll.mutate(
        { target: pending.target, userIds: ids },
        {
          onSuccess: (r) => {
            toast.success(
              t('adminUsers.toast.bulkLoggedOut', { total: r.total, online: r.online, offline: r.offline }),
            );
            if (pending.target === 'selected') setSelected(new Set());
          },
          onError: fail,
          onSettled: done,
        },
      );
    }
  };

  const bulk = (target: LogoutTarget) => {
    if (target === 'selected' && selected.size === 0) {
      toast.warning(t('adminUsers.bulk.selectFirst'));
      return;
    }
    setPending({ kind: 'bulk', target });
  };

  const dialog = (() => {
    if (!pending) return null;
    if (pending.kind === 'toggle') {
      const activate = !pending.user.is_active;
      return {
        title: t(activate ? 'adminUsers.confirm.activateTitle' : 'adminUsers.confirm.deactivateTitle'),
        message: t(activate ? 'adminUsers.confirm.activate' : 'adminUsers.confirm.deactivate', {
          name: pending.user.full_name || pending.user.user_id,
        }),
        tone: activate ? ('primary' as const) : ('danger' as const),
        loading: update.isPending,
      };
    }
    if (pending.kind === 'logout') {
      const online = onlineIds.has(String(pending.user.user_id));
      return {
        title: t('adminUsers.confirm.logoutTitle'),
        message: t(online ? 'adminUsers.confirm.logoutOnline' : 'adminUsers.confirm.logoutOffline', {
          name: pending.user.full_name || pending.user.user_id,
        }),
        tone: 'danger' as const,
        loading: forceLogout.isPending,
      };
    }
    const includesMe =
      pending.target === 'all' ||
      (pending.target === 'selected' && meId !== undefined && selected.has(meId)) ||
      (pending.target === 'online' && meId !== undefined && onlineIds.has(String(meId)));
    return {
      title: t('adminUsers.confirm.bulkTitle'),
      message:
        t(`adminUsers.confirm.bulk.${pending.target}`, { count: selected.size }) +
        (includesMe ? ` ${t('adminUsers.confirm.includesYou')}` : ''),
      tone: 'danger' as const,
      loading: forceLogoutAll.isPending,
    };
  })();

  return (
    <>
      <PageHeader
        title={t('adminUsers.title')}
        description={t('adminUsers.subtitle')}
        icon={<UserCog className="h-6 w-6" aria-hidden />}
        actions={
          <>
            <Link
              to="/admin/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 font-semibold text-fg hover:bg-subtle"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              {t('nav.adminDashboard')}
            </Link>
            <Button
              variant="secondary"
              startIcon={<RefreshCw className={users.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              onClick={() => void users.refetch()}
              disabled={users.isFetching}
            >
              {t('adminUsers.refresh')}
            </Button>
          </>
        }
        filters={<UserFiltersBar value={filters} onChange={setFilters} />}
      />

      <section
        aria-label={t('adminUsers.bulk.title')}
        className="mb-4 rounded-2xl border border-line bg-surface p-4 shadow-sm"
      >
        <h2 className="mb-3 text-base font-bold text-fg">{t('adminUsers.bulk.title')}</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="danger"
            size="sm"
            startIcon={<UserX className="h-4 w-4" />}
            onClick={() => bulk('all')}
          >
            {t('adminUsers.bulk.all')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            startIcon={<Wifi className="h-4 w-4" />}
            onClick={() => bulk('online')}
          >
            {t('adminUsers.bulk.online')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            startIcon={<WifiOff className="h-4 w-4" />}
            onClick={() => bulk('offline')}
          >
            {t('adminUsers.bulk.offline')}
          </Button>
          <Button size="sm" startIcon={<ListChecks className="h-4 w-4" />} onClick={() => bulk('selected')}>
            {t('adminUsers.bulk.selected', { count: selected.size })}
          </Button>
        </div>
      </section>

      {users.isError ? (
        <AlertMessage type="error" message={errorText(users.error, t('adminUsers.loadFailed'))} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-light px-3 py-1 font-bold text-brand-fg">
              <Users className="h-4 w-4" aria-hidden />
              {hasFilters(filters)
                ? t('adminUsers.countFiltered', { shown: shown.length, total: users.data?.length ?? 0 })
                : t('adminUsers.count', { count: shown.length })}
            </span>
            {shown.length > 0 && (
              <Checkbox
                label={t('adminUsers.selectAllShown', { count: shown.length })}
                checked={selectedShown === shown.length}
                indeterminate={selectedShown > 0 && selectedShown < shown.length}
                onChange={toggleAllShown}
              />
            )}
          </div>
          <UsersTable
            users={shown}
            loading={users.isLoading}
            onlineIds={onlineIds}
            selected={selected}
            meId={meId}
            emptyTitle={hasFilters(filters) ? t('adminUsers.noMatch') : t('adminUsers.empty')}
            onToggleSelect={toggleSelect}
            onEdit={openEdit}
            onToggleActive={askToggle}
            onForceLogout={askLogout}
          />
        </>
      )}

      {editing && <EditUserDialog key={editing.user_id} user={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!pending}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        tone={dialog?.tone}
        loading={busy && (dialog?.loading ?? false)}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </>
  );
}

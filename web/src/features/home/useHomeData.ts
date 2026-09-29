import { useMemo } from 'react';
import { useNotifications } from '@/api/notifications';
import { usePlatformStats } from '@/api/platform';
import { useIncomingRequests, useMyRequests, usePendingRatings } from '@/api/requests';
import { useUnseen } from '@/features/requests/unseen';
import { useAdminUsers } from '@/features/admin-users/hooks/useAdminUsers';
import { useProviderAccount } from '@/features/map/provider/queries';
import { useAuthStore } from '@/store/authStore';
import {
  buildSignals,
  countInactive,
  countUnseen,
  summarizeRequests,
  type ProviderState,
  type RequestSummary,
  type Signal,
} from './model';

export interface HomeData {
  /** First load of anything the "needs you" list depends on. */
  loading: boolean;
  /** At least one of those calls failed (the rest of the list is still shown). */
  failed: boolean;
  retry: () => void;
  signals: Signal[];
  requests: RequestSummary;
  unread: number;
  inactiveUsers: number;
  provider: ProviderState | null;
  platform: ReturnType<typeof usePlatformStats>;
}

/**
 * Everything the home page shows, from the hooks the rest of the app already uses (so the numbers match the bell,
 * the requests list and the admin pages, and the calls are shared through the query cache). Role gates only decide
 * what is fetched and shown; the server re-checks every endpoint.
 */
export function useHomeData(): HomeData {
  const role = useAuthStore((s) => s.user?.role);
  const uid = useAuthStore((s) => s.user?.user_id);
  const isProvider = role === 'provider';
  const isAdmin = role === 'admin';

  const mine = useMyRequests();
  const incoming = useIncomingRequests(isProvider);
  const account = useProviderAccount();
  const ratings = usePendingRatings();
  const notifications = useNotifications();
  const users = useAdminUsers(isAdmin);
  const platform = usePlatformStats();
  const unseenIds = useUnseen((s) => s.ids);

  const requests = useMemo<RequestSummary>(() => {
    const s = summarizeRequests(mine.data ?? [], uid ?? -1);
    // The provider's own queue is polled every 15 s, so it is fresher than the list of all requests.
    return isProvider && incoming.data ? { ...s, incoming: incoming.data.length } : s;
  }, [mine.data, incoming.data, uid, isProvider]);

  const unseen = useMemo(() => countUnseen(unseenIds, mine.data ?? [], uid ?? -1), [unseenIds, mine.data, uid]);

  const provider: ProviderState | null = useMemo(() => {
    if (!isProvider || !account.data) return null;
    if (account.data.kind === 'ready') return account.data.service.status === 0 ? 'available' : 'busy';
    return account.data.kind;
  }, [isProvider, account.data]);

  const inactiveUsers = useMemo(() => countInactive(users.data ?? []), [users.data]);

  const signals = useMemo(
    () =>
      buildSignals({
        role: role ?? 'user',
        requests,
        unseen,
        pendingRatings: ratings.data?.length ?? 0,
        unreadNotifications: notifications.unread,
        inactiveUsers,
        provider,
      }),
    [role, requests, unseen, ratings.data, notifications.unread, inactiveUsers, provider],
  );

  const watched = [mine, isProvider ? incoming : null, isProvider ? account : null, isAdmin ? users : null];
  const active = watched.filter((q): q is NonNullable<typeof q> => q !== null);
  return {
    loading: active.some((q) => q.isLoading),
    failed: active.some((q) => q.isError),
    retry: () => active.filter((q) => q.isError).forEach((q) => void q.refetch()),
    signals,
    requests,
    unread: notifications.unread,
    inactiveUsers,
    provider,
    platform,
  };
}

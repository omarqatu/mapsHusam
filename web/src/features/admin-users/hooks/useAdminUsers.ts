import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminUsersApi, type LogoutTarget, type UserUpdate } from '@/api/adminUsers';

export const adminUserKeys = {
  all: ['admin', 'users'] as const,
  online: ['admin', 'online-users'] as const,
  view: (id: number) => ['admin', 'view-session', id] as const,
  viewMessages: (id: number, requestId: number) =>
    ['admin', 'view-session', id, 'messages', requestId] as const,
};

/** Legacy refreshed the online dots every 8 seconds. */
export const ONLINE_POLL_MS = 8000;

/**
 * All users (the server has no paging). The online set of the same answer seeds the light polling query.
 * `enabled` lets a page that only sometimes needs it (the home page) skip the call for non-admins.
 */
export function useAdminUsers(enabled = true) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: adminUserKeys.all,
    queryFn: async () => {
      const res = await adminUsersApi.list();
      qc.setQueryData(adminUserKeys.online, { success: true, onlineUserIds: res.onlineUserIds });
      return res.users;
    },
    staleTime: 30_000,
    enabled,
  });
}

/** Ids (as strings) of users with a live socket; polled only while the page is mounted and the tab visible. */
export function useOnlineIds(enabled: boolean): ReadonlySet<string> {
  const { data } = useQuery({
    queryKey: adminUserKeys.online,
    queryFn: adminUsersApi.online,
    enabled,
    refetchInterval: ONLINE_POLL_MS,
    staleTime: ONLINE_POLL_MS / 2,
    retry: false,
  });
  return new Set(data?.onlineUserIds.map(String) ?? []);
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UserUpdate) => adminUsersApi.update(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}

export function useForceLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => adminUsersApi.forceLogout(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}

export function useForceLogoutAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { target: LogoutTarget; userIds?: number[] }) =>
      adminUsersApi.forceLogoutAll(v.target, v.userIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}

/** A fresh 30-minute read-only token for one user; also the profile, then the requests with that token. */
export function useViewSession(userId: number) {
  const session = useQuery({
    queryKey: adminUserKeys.view(userId),
    queryFn: () => adminUsersApi.viewSession(userId),
    enabled: Number.isInteger(userId) && userId > 0,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  });
  const token = session.data?.token;
  const profile = useQuery({
    queryKey: [...adminUserKeys.view(userId), 'profile'],
    queryFn: () => adminUsersApi.viewProfile(token!),
    enabled: !!token,
    retry: false,
  });
  const requests = useQuery({
    queryKey: [...adminUserKeys.view(userId), 'requests'],
    queryFn: () => adminUsersApi.viewRequests(token!),
    enabled: !!token,
    retry: false,
  });
  return { session, profile, requests };
}

export function useViewMessages(
  userId: number,
  token: string | undefined,
  requestId: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: adminUserKeys.viewMessages(userId, requestId),
    queryFn: () => adminUsersApi.viewMessages(token!, requestId),
    enabled: enabled && !!token,
    retry: false,
  });
}

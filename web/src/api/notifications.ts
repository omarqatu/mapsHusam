import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from './client';
import { useSocket, type AppSocket } from './socket';

// Notifications (legacy js/notifications.js). There is no HTTP endpoint: the server only speaks socket.io
// (`get_unread_notifications` → `unread_notifications`, `mark_notification_read`, push `new_notification`).
// The list still lives in the TanStack Query cache; the query function simply asks over the socket.

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/** A row of the server's `notifications` table (its `type` column is limited to the four values above). */
export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationType | null;
  is_read: boolean | null;
  created_at: string;
}
/** Pushed live: no `is_read` (always new). */
export type NotificationPush = Omit<AppNotification, 'is_read'>;

export const notificationKeys = { list: (uid: number | undefined) => ['notifications', uid] as const };

const ANSWER_TIMEOUT_MS = 8000;

/** Asks for the last 50 notifications and resolves with the server's answer. */
export function fetchNotifications(socket: AppSocket): Promise<AppNotification[]> {
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      socket.off('unread_notifications', onList);
      socket.off('notifications_error', onError);
    };
    const onList = (rows: AppNotification[]) => {
      done();
      resolve(rows);
    };
    const onError = () => {
      done();
      reject(new ApiError('notifications', 500));
    };
    const timer = setTimeout(() => {
      done();
      reject(new ApiError('timeout', 0));
    }, ANSWER_TIMEOUT_MS);
    socket.on('unread_notifications', onList);
    socket.on('notifications_error', onError);
    socket.emit('get_unread_notifications');
  });
}

/** Unread = anything the server has not marked read (legacy counted the whole list, read rows included). */
export const isUnread = (n: Pick<AppNotification, 'is_read'>) => n.is_read !== true;
export const countUnread = (items: readonly AppNotification[]) => items.filter(isUnread).length;

/** New push on top, no duplicates, still the server's limit of 50. */
export function withPush(items: readonly AppNotification[] | undefined, push: NotificationPush): AppNotification[] {
  const rest = (items ?? []).filter((n) => n.id !== push.id);
  return [{ ...push, is_read: false }, ...rest].slice(0, 50);
}

export function withRead(items: readonly AppNotification[] | undefined, ids: readonly number[]): AppNotification[] {
  return (items ?? []).map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n));
}

/** The server drops events beyond 20 per second per connection — "mark all" is paced below that. */
const MARK_ALL_GAP_MS = 80;

/**
 * The signed-in user's notifications (newest first), kept live, with read / mark-all-read actions.
 * Mount `useNotificationsRealtime` once (the connected menu does); this hook can be used anywhere.
 */
export function useNotifications() {
  const uid = useAuthStore((s) => s.user?.user_id);
  const socket = useSocket();
  const qc = useQueryClient();
  const key = notificationKeys.list(uid);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchNotifications(socket!),
    enabled: !!uid && !!socket,
    staleTime: 60_000,
  });

  const markRead = useCallback(
    (id: number) => {
      socket?.emit('mark_notification_read', id);
      qc.setQueryData<AppNotification[]>(key, (old) => withRead(old, [id]));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is derived from `uid`
    [socket, qc, uid],
  );

  const markAllRead = useCallback(() => {
    const ids = (qc.getQueryData<AppNotification[]>(key) ?? []).filter(isUnread).map((n) => n.id);
    ids.forEach((id, i) => setTimeout(() => socket?.emit('mark_notification_read', id), i * MARK_ALL_GAP_MS));
    qc.setQueryData<AppNotification[]>(key, (old) => withRead(old, ids));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is derived from `uid`
  }, [socket, qc, uid]);

  const items = query.data ?? [];
  return {
    items,
    unread: countUnread(items),
    isLoading: query.isLoading,
    isError: query.isError,
    refresh: () => void query.refetch(),
    isRefreshing: query.isFetching,
    markRead,
    markAllRead,
  };
}

/**
 * Live side of the list: pushes go into the cache (and to `onPush`, for the toast / browser notification), a
 * reconnect reloads, and `service_request_*` events reload too — the server writes a notification row for those
 * but does not push it.
 */
export function useNotificationsRealtime(onPush?: (n: NotificationPush) => void) {
  const uid = useAuthStore((s) => s.user?.user_id);
  const socket = useSocket();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket || !uid) return;
    const key = notificationKeys.list(uid);
    const reload = () => void qc.invalidateQueries({ queryKey: key });
    // The row is written just before (or just after) the event goes out; give the insert a moment.
    const reloadSoon = () => window.setTimeout(reload, 700);

    const onNew = (n: NotificationPush) => {
      qc.setQueryData<AppNotification[]>(key, (old) => (old ? withPush(old, n) : old));
      onPush?.(n);
    };
    socket.on('new_notification', onNew);
    socket.on('service_request_new', reloadSoon);
    socket.on('service_request_response', reloadSoon);
    socket.on('service_request_completed', reloadSoon);
    socket.on('service_request_cancelled', reloadSoon);
    socket.io.on('reconnect', reload);
    return () => {
      socket.off('new_notification', onNew);
      socket.off('service_request_new', reloadSoon);
      socket.off('service_request_response', reloadSoon);
      socket.off('service_request_completed', reloadSoon);
      socket.off('service_request_cancelled', reloadSoon);
      socket.io.off('reconnect', reload);
    };
  }, [socket, uid, qc, onPush]);
}

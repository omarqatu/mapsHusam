import type { Socket } from 'socket.io-client';
import { create } from 'zustand';
import type { AppNotification, NotificationPush } from './notifications';
import type { ChatMessage, ContactNumbers } from './requests';

// Events found in server.js (io handlers + the service-request routes). Payloads are typed from what the server
// actually sends — see PLAN.md item 7 for where each field comes from.
export interface ServerToClientEvents {
  connection_confirmed: (p: { userId: number; socketId: string }) => void;
  force_relogin: (p: unknown) => void;
  new_notification: (p: NotificationPush) => void;
  unread_notifications: (p: AppNotification[]) => void;
  notification_marked_read: (p: { success: boolean }) => void;
  notification_sent: (p: unknown) => void;
  notification_error: (p: { error: string }) => void;
  notifications_error: (p: { error: string }) => void;
  service_request_new: (p: { id: number; requestId: number; serviceType: string; createdAt: string }) => void;
  service_request_response: (p: {
    requestId: number;
    status: 'accepted' | 'rejected';
    serviceType: string | null;
    providerName: string | null;
  }) => void;
  service_request_message: (p: { requestId: number; message: ChatMessage }) => void;
  /** The requester gets all four numbers, the provider only the requester's two. */
  service_request_completed: (p: { requestId: number } & ContactNumbers) => void;
  service_request_cancelled: (p: { requestId: number; reason: string }) => void;
}
export interface ClientToServerEvents {
  /** The server ignores any argument: the user comes from the token. */
  user_connected: () => void;
  send_notification: (p: unknown) => void;
  /** The server answers with `unread_notifications` (the last 50 rows, read ones included). */
  get_unread_notifications: () => void;
  mark_notification_read: (id: number) => void;
}
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const useSocketStore = create<{ socket: AppSocket | null }>(() => ({ socket: null }));

/** `null` while logged out / not yet created. Subscribe to events in an effect and clean up. */
export function useSocket() {
  return useSocketStore((s) => s.socket);
}

export function setSocket(socket: AppSocket | null) {
  useSocketStore.setState({ socket });
}

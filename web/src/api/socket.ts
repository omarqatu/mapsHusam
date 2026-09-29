import type { Socket } from 'socket.io-client';
import { create } from 'zustand';

// Events found in server.js. Payloads marked `unknown` are typed when the page that uses them is
// ported (its parity checklist lists the exact fields) — don't guess them here.
export interface ServerToClientEvents {
  connection_confirmed: (p: { userId: number; socketId: string }) => void;
  force_relogin: (p: unknown) => void;
  new_notification: (p: unknown) => void;
  unread_notifications: (p: unknown) => void;
  notification_marked_read: (p: unknown) => void;
  notification_sent: (p: unknown) => void;
  notification_error: (p: { error: string }) => void;
  notifications_error: (p: unknown) => void;
  service_request_new: (p: unknown) => void;
  service_request_response: (p: unknown) => void;
  service_request_message: (p: unknown) => void;
  service_request_completed: (p: unknown) => void;
  service_request_cancelled: (p: unknown) => void;
}
export interface ClientToServerEvents {
  user_connected: () => void;
  send_notification: (p: unknown) => void;
  get_unread_notifications: (p?: unknown) => void;
  mark_notification_read: (p: unknown) => void;
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

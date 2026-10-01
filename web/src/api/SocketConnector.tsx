import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import { authApi } from './auth';
import { queryClient } from './queryClient';
import { widgetsKeys } from './widgets';
import { setSocket, type AppSocket } from './socket';

/**
 * Mount once. The socket only exists while logged in (the server rejects unauthenticated
 * connections), follows the token, and is disconnected on logout.
 */
export default function SocketConnector() {
  const token = useAuthStore((s) => s.user?.token);

  useEffect(() => {
    if (!token) return;
    const s: AppSocket = io({ auth: { token }, transports: ['websocket', 'polling'] });
    s.on('connect', () => s.emit('user_connected'));
    // Refused, or dropped by the server: the session may have ended (logout elsewhere, expiry, password change). Ask over
    // HTTP — a 401 there logs out with a message; a network blip changes nothing.
    const checkSession = () => void authApi.session().catch(() => undefined);
    s.on('connect_error', (e) => e.message === 'unauthorized' && checkSession());
    s.on('disconnect', (reason) => reason === 'io server disconnect' && checkSession());
    // Server: an admin force-logged this user out.
    s.on('force_relogin', () => useAuthStore.getState().logout());
    // Server: an admin changed statuses — refetch now instead of waiting for the minute poll (visitors have no socket and keep polling).
    s.on('status_updated', ({ layer }) => {
      void queryClient.invalidateQueries({ queryKey: ['status-rows', layer] });
      void queryClient.invalidateQueries({ queryKey: widgetsKeys.data });
    });
    s.on('widgets_updated', () => void queryClient.invalidateQueries({ queryKey: widgetsKeys.data }));
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [token]);

  return null;
}

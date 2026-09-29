import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
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
    // Server: an admin force-logged this user out.
    s.on('force_relogin', () => useAuthStore.getState().logout());
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [token]);

  return null;
}

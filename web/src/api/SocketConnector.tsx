import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import { authApi } from './auth';
import { queryClient } from './queryClient';
import { widgetsKeys } from './widgets';
import { platformKeys } from './platform';
import { setSocket, type AppSocket } from './socket';
import { platformContentApi, platformContentKeys } from './platformContent';
import { VISIBILITY_KEY, parseVisibility } from '@/features/visibility/model';
import { setVisibility } from '@/features/visibility/store';

/**
 * Mount once. The socket only exists while logged in (the server rejects unauthenticated
 * connections), follows the token, and is disconnected on logout.
 */
export default function SocketConnector() {
  const token = useAuthStore((s) => s.user?.token);

  useEffect(() => {
    // Public, read-only event channel: visitors also receive admin settings and map edits immediately.
    const transports = import.meta.env.DEV ? ['polling'] : ['websocket', 'polling'];
    const s = io('/public', { transports });
    const refreshMapData = () => {
      window.dispatchEvent(new Event('map-data-updated'));
      for (const root of ['featured', 'search-page', 'global-search', 'unique-values', 'listing-page', 'provider-linked-features', 'provider', 'my-listings'])
        void queryClient.invalidateQueries({ queryKey: [root] });
      void queryClient.invalidateQueries({ queryKey: platformKeys.stats });
    };
    const syncVisibility = () => {
      void platformContentApi.get(VISIBILITY_KEY).then((res) => {
        const visibility = parseVisibility(res.item?.content_value);
        setVisibility(visibility);
      }).catch(() => undefined);
    };
    const syncLatest = () => {
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'platform-content' });
      syncVisibility();
      refreshMapData();
    };
    // The page has just loaded everything; only a reconnect may have missed events.
    let connectedBefore = false;
    s.on('connect', () => {
      if (connectedBefore) syncLatest();
      connectedBefore = true;
    });
    s.on('platform_content_updated', ({ key }: { key: string }) => {
      if (key !== VISIBILITY_KEY) {
        void queryClient.invalidateQueries({ queryKey: platformContentKeys.item(key) });
        return;
      }
      void platformContentApi.get(VISIBILITY_KEY).then((res) => {
        const visibility = parseVisibility(res.item?.content_value);
        setVisibility(visibility);
        // The admin page edits a draft of this cached item: keep it current so a second admin does not save over it.
        queryClient.setQueryData(platformContentKeys.item(VISIBILITY_KEY), visibility);
        void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'platform-content' });
      }).catch(() => void queryClient.invalidateQueries({ queryKey: platformContentKeys.item(VISIBILITY_KEY) }));
    });
    s.on('map_data_updated', () => {
      refreshMapData();
    });
    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    // Vite's WS proxy can abort an in-flight write while HMR reloads modules. Polling keeps the live socket reliable in
    // development; production connects over WebSocket and can fall back to polling as usual.
    const transports = import.meta.env.DEV ? ['polling'] : ['websocket', 'polling'];
    const s: AppSocket = io({ auth: { token }, transports });
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

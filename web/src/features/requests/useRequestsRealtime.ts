import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { requestKeys } from '@/api/requests';
import { useSocket } from '@/api/socket';
import { toast } from '@/components/ui/toastStore';
import { useRequestsUi } from './store';
import { useUnseen } from './unseen';

/**
 * The live side of service requests (legacy notifications.js → CustomEvents → service-chat.js, without the
 * `document` events): every event refreshes the TanStack Query data, and some also open / mark things.
 * Mount once while signed in.
 */
export function useRequestsRealtime() {
  const { t } = useTranslation();
  const socket = useSocket();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket) return;
    const refresh = () => void qc.invalidateQueries({ queryKey: requestKeys.all });
    const ui = () => useRequestsUi.getState();

    // The provider's queue (banner + ring) lives in the incoming query.
    const onNew = () => refresh();

    const onResponse = (p: { requestId: number; status: 'accepted' | 'rejected'; providerName: string | null }) => {
      refresh();
      if (p.status === 'accepted') {
        toast.success(t('requests.live.accepted'));
        ui().openChat(p.requestId);
      } else {
        toast.error(t('requests.live.rejected'));
        useUnseen.getState().clear(p.requestId);
      }
    };

    const onMessage = (p: { requestId: number }) => {
      void qc.invalidateQueries({ queryKey: requestKeys.messages(p.requestId) });
      if (ui().chatId === p.requestId) return; // already looking at it
      useUnseen.getState().add(p.requestId);
      // Legacy: a message reopens its chat unless the user is in another one.
      if (ui().chatId === null) ui().openChat(p.requestId);
    };

    const onCompleted = (p: { requestId: number }) => {
      refresh();
      useUnseen.getState().clear(p.requestId);
      if (ui().chatId !== p.requestId) toast.success(t('requests.live.completed'));
    };

    const onCancelled = (p: { requestId: number; reason: string }) => {
      refresh();
      useUnseen.getState().clear(p.requestId);
      toast.warning(t('requests.live.cancelled', { reason: p.reason }));
    };

    socket.on('service_request_new', onNew);
    socket.on('service_request_response', onResponse);
    socket.on('service_request_message', onMessage);
    socket.on('service_request_completed', onCompleted);
    socket.on('service_request_cancelled', onCancelled);
    socket.io.on('reconnect', refresh);
    return () => {
      socket.off('service_request_new', onNew);
      socket.off('service_request_response', onResponse);
      socket.off('service_request_message', onMessage);
      socket.off('service_request_completed', onCompleted);
      socket.off('service_request_cancelled', onCancelled);
      socket.io.off('reconnect', refresh);
    };
  }, [socket, qc, t]);
}

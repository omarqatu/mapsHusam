import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/client';
import { useRespondToRequest, type ServiceRequest } from '@/api/requests';
import { toast } from '@/components/ui/toastStore';
import { errorText } from './errors';
import { useRequestsUi } from './store';
import { useUnseen } from './unseen';

/**
 * Provider's accept / reject, shared by the incoming banner and the requests list.
 * Accepting opens the chat; declining requires a reason. A request someone already answered (409) is refreshed.
 */
export function useRespond() {
  const { t } = useTranslation();
  const mutation = useRespondToRequest();
  const respond = (
    req: Pick<ServiceRequest, 'id'>,
    action: 'accept' | 'reject',
    reason?: string,
    onSuccess?: () => void,
  ) =>
    mutation.mutate(
      { id: req.id, action, reason },
      {
        onSuccess: () => {
          useUnseen.getState().clear(req.id);
          if (action === 'accept') useRequestsUi.getState().openChat(req.id);
          else toast.info(t('requests.incoming.rejected'));
          onSuccess?.();
        },
        onError: (e) => {
          const answered = e instanceof ApiError && (e.status === 409 || e.status === 400);
          toast[answered ? 'warning' : 'error'](errorText(e, t('requests.incoming.respondFailed')));
        },
      },
    );
  return { respond, pending: mutation.isPending, pendingId: mutation.variables?.id };
}

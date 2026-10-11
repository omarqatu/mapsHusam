import { useRespond } from './respond';
import ReasonDialog from './ReasonDialog';
import { useRequestsUi } from './store';

/** One shared reason dialog for every provider entry point to a pending request. */
export default function RequestRejectionDialog() {
  const requestId = useRequestsUi((s) => s.rejectRequestId);
  const close = useRequestsUi((s) => s.closeReject);
  const { respond, pending } = useRespond();

  if (requestId === null) return null;

  return (
    <ReasonDialog
      open
      intent="reject"
      loading={pending}
      onClose={close}
      onSubmit={(reason) =>
        respond({ id: requestId }, 'reject', reason, () => {
          close();
        })
      }
    />
  );
}

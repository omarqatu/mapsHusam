import { useState } from 'react';
import clsx from 'clsx';
import { Archive, Ban, Check, MessageCircle, MessageSquarePlus, Star, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useCancelRequest,
  useMyRequests,
  usePendingComments,
  usePendingRatings,
  type RequestStatus,
  type ServiceRequest,
} from '@/api/requests';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toastStore';
import { formatDateTime } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { errorText } from './errors';
import { isCancellable, otherPartyName, roleIn } from './model';
import ReasonDialog from './ReasonDialog';
import { useRespond } from './respond';
import { useRequestsUi } from './store';
import { useUnseen } from './unseen';

const TONE: Record<RequestStatus, string> = {
  pending: 'text-amber-600',
  accepted: 'text-blue-600',
  rejected: 'text-red-600',
  cancelled: 'text-slate-500',
  completed: 'text-green-600',
};

function RequestCard({ r, uid, onCancel }: { r: ServiceRequest; uid: number; onCancel: (id: number) => void }) {
  const { t, i18n } = useTranslation();
  const openChat = useRequestsUi((s) => s.openChat);
  const openRating = useRequestsUi((s) => s.openRating);
  const openComment = useRequestsUi((s) => s.openComment);
  const unseen = useUnseen((s) => s.ids.includes(r.id));
  const pendingRatings = usePendingRatings();
  const pendingComments = usePendingComments();
  const { respond, pending, pendingId } = useRespond();

  const role = roleIn(r, uid);
  const mine = Number(r.user_id) === uid;
  const other = otherPartyName(r, role);
  const otherLabel = other ?? t(role === 'user' ? 'requests.provider' : 'requests.requester');
  const service = r.service_type || t('requests.defaultService');
  const busy = pending && pendingId === r.id;

  const rateable = mine && r.status === 'completed' && pendingRatings.data?.some((p) => p.id === r.id);
  const commentable = mine ? pendingComments.data?.find((p) => p.request_id === r.id) : undefined;

  return (
    <li
      className={clsx(
        'flex flex-col gap-1.5 rounded-lg border p-3',
        unseen || rateable || commentable ? 'border-brand bg-brand-light/40' : 'border-slate-200 bg-slate-50',
      )}
    >
      <div className="flex items-center justify-between gap-2 text-sm font-bold text-slate-800">
        <span>
          {service} ({otherLabel})
        </span>
        {unseen && (
          <span className="rounded-full bg-whatsapp px-2 py-0.5 text-[10px] font-bold text-white">
            {t('requests.new')}
          </span>
        )}
      </div>
      <p className={clsx('text-xs font-bold', TONE[r.status])}>
        {t('requests.statusLabel')}:{' '}
        {r.status === 'cancelled'
          ? t('requests.status.cancelled', { reason: r.cancellation_reason || t('requests.noReason') })
          : t(`requests.status.${r.status}`)}
      </p>
      <p className="text-[11px] text-slate-400">{formatDateTime(r.created_at, i18n.language)}</p>

      <div className="mt-1 flex flex-wrap gap-2">
        {(r.status === 'accepted' || r.status === 'completed') && (
          <Button
            size="sm"
            variant={r.status === 'completed' ? 'secondary' : 'primary'}
            startIcon={
              r.status === 'completed' ? (
                <Archive className="h-4 w-4" aria-hidden />
              ) : (
                <MessageCircle className="h-4 w-4" aria-hidden />
              )
            }
            onClick={() => openChat(r.id)}
          >
            {t(r.status === 'completed' ? 'requests.openArchive' : 'requests.openChat')}
          </Button>
        )}
        {r.status === 'pending' && role === 'provider' && (
          <>
            <Button
              size="sm"
              startIcon={<Check className="h-4 w-4" aria-hidden />}
              loading={busy}
              disabled={pending}
              onClick={() => respond(r, 'accept')}
            >
              {t('requests.accept')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              startIcon={<X className="h-4 w-4" aria-hidden />}
              disabled={pending}
              onClick={() => respond(r, 'reject')}
            >
              {t('requests.reject')}
            </Button>
          </>
        )}
        {rateable && (
          <Button
            size="sm"
            startIcon={<Star className="h-4 w-4" aria-hidden />}
            onClick={() => openRating({ requestId: r.id, providerName: otherLabel, serviceType: service })}
          >
            {t('requests.rate')}
          </Button>
        )}
        {commentable && (
          <Button
            size="sm"
            variant="secondary"
            startIcon={<MessageSquarePlus className="h-4 w-4" aria-hidden />}
            onClick={() => openComment({ ratingId: commentable.id, providerName: otherLabel, serviceType: service })}
          >
            {t('requests.writeComment')}
          </Button>
        )}
        {isCancellable(r.status) && (
          <Button
            size="sm"
            variant="danger"
            startIcon={<Ban className="h-4 w-4" aria-hidden />}
            onClick={() => onCancel(r.id)}
          >
            {t('requests.cancel')}
          </Button>
        )}
      </div>
    </li>
  );
}

/** "My requests": every request I sent or received, with the actions each state allows (legacy showActiveRequestsList). */
export default function MyRequestsDialog() {
  const { t } = useTranslation();
  const open = useRequestsUi((s) => s.listOpen);
  const close = useRequestsUi((s) => s.closeList);
  const uid = useAuthStore((s) => s.user?.user_id);
  const requests = useMyRequests(open);
  const cancel = useCancelRequest();
  const [cancelId, setCancelId] = useState<number | null>(null);

  if (!open || !uid) return null;

  return (
    <>
      <Modal open onClose={close} title={t('requests.listTitle')} widthClass="max-w-md">
        {requests.isLoading ? (
          <CenteredSpinner />
        ) : requests.isError ? (
          <AlertMessage type="error" message={t('requests.loadFailed')} />
        ) : requests.data?.length ? (
          <ul className="flex flex-col gap-2.5">
            {requests.data.map((r) => (
              <RequestCard key={r.id} r={r} uid={uid} onCancel={setCancelId} />
            ))}
          </ul>
        ) : (
          <EmptyState title={t('requests.empty')} />
        )}
      </Modal>
      {cancelId !== null && (
        <ReasonDialog
          open
          loading={cancel.isPending}
          onClose={() => setCancelId(null)}
          onSubmit={(reason) =>
            cancel.mutate(
              { id: cancelId, reason },
              {
                onSuccess: () => {
                  toast.success(t('requests.cancelDialog.done'));
                  setCancelId(null);
                },
                onError: (e) => {
                  toast.error(errorText(e, t('requests.cancelDialog.failed')));
                  setCancelId(null);
                },
              },
            )
          }
        />
      )}
    </>
  );
}

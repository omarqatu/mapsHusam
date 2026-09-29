import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Ban, CheckCircle2, Handshake, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  REQUEST_LIMITS,
  useCancelRequest,
  useChatMessages,
  useConfirmAgreement,
  useMyRequests,
  usePendingRatings,
  useSendMessage,
  type ServiceRequest,
} from '@/api/requests';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import { CenteredSpinner } from '@/components/ui/Spinner';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import { useAuthStore } from '@/store/authStore';
import ContactBox from './ContactBox';
import { errorText } from './errors';
import { contactFor, hasConfirmed, otherPartyName, roleIn } from './model';
import ReasonDialog from './ReasonDialog';
import { useRequestsUi } from './store';
import { useUnseen } from './unseen';

/** Delay before the rating dialog follows a completed agreement (legacy: 1-1.5 s, so the contacts are seen first). */
const RATING_DELAY_MS = 1200;

function Chat({ req, uid }: { req: ServiceRequest; uid: number }) {
  const { t, i18n } = useTranslation();
  const closeChat = useRequestsUi((s) => s.closeChat);
  const openRating = useRequestsUi((s) => s.openRating);
  const role = roleIn(req, uid);
  const other = otherPartyName(req, role);
  const otherLabel = other ?? t(role === 'user' ? 'requests.provider' : 'requests.requester');
  const serviceType = req.service_type ?? t('requests.defaultService');

  const messagesQ = useChatMessages(req.id, req.status !== 'completed');
  const status = messagesQ.data?.requestStatus ?? req.status;
  const completed = status === 'completed';
  const open = status === 'accepted';
  const pendingRatings = usePendingRatings();
  const send = useSendMessage();
  const confirm = useConfirmAgreement();
  const cancel = useCancelRequest();
  const [text, setText] = useState('');
  const [askConfirm, setAskConfirm] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const ratingShown = useRef(false);

  // Opening the chat is "seeing" it.
  useEffect(() => useUnseen.getState().clear(req.id), [req.id]);

  const messages = messagesQ.data?.messages;
  useEffect(() => {
    const el = bodyRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  // The requester is asked to rate as soon as the agreement is complete (once per opened chat).
  const needsRating = pendingRatings.data?.some((p) => p.id === req.id) ?? false;
  useEffect(() => {
    if (!completed || role !== 'user' || !needsRating || ratingShown.current) return;
    ratingShown.current = true;
    const id = window.setTimeout(
      () => openRating({ requestId: req.id, providerName: otherLabel, serviceType }),
      RATING_DELAY_MS,
    );
    return () => {
      window.clearTimeout(id);
      ratingShown.current = false;
    };
  }, [completed, role, needsRating, req.id, otherLabel, serviceType, openRating]);

  const contact = useMemo(() => contactFor(role, messagesQ.data ?? req), [role, messagesQ.data, req]);
  const iConfirmed = hasConfirmed(req, role) || confirm.isSuccess;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const message = text.trim();
    if (!message || send.isPending) return;
    send.mutate(
      { id: req.id, role, message },
      {
        onSuccess: () => {
          setText('');
          stick.current = true;
        },
        onError: (err) => toast.error(errorText(err, t('requests.chat.sendFailed'))),
      },
    );
  };

  const doConfirm = () =>
    confirm.mutate(
      { id: req.id, role },
      {
        onSuccess: (res) => {
          setAskConfirm(false);
          toast.success(t(res.status === 'completed' ? 'requests.chat.completedToast' : 'requests.chat.waitingToast'));
        },
        onError: (err) => {
          setAskConfirm(false);
          toast.error(errorText(err, t('requests.chat.confirmFailed')));
        },
      },
    );

  const doCancel = (reason: string) =>
    cancel.mutate(
      { id: req.id, reason },
      {
        onSuccess: () => {
          toast.success(t('requests.cancelDialog.done'));
          closeChat();
        },
        onError: (err) => {
          setAskCancel(false);
          toast.error(errorText(err, t('requests.cancelDialog.failed')));
        },
      },
    );

  return (
    <>
      <Modal
        open
        onClose={closeChat}
        title={t('requests.chat.title', { name: otherLabel })}
        widthClass="max-w-md"
        footer={
          open ? (
            <>
              <Button
                className="flex-[2]"
                startIcon={<Handshake className="h-4 w-4" aria-hidden />}
                onClick={() => setAskConfirm(true)}
                disabled={iConfirmed}
              >
                {t(iConfirmed ? 'requests.chat.confirmWaiting' : 'requests.chat.confirm')}
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                startIcon={<Ban className="h-4 w-4" aria-hidden />}
                onClick={() => setAskCancel(true)}
              >
                {t('requests.cancel')}
              </Button>
            </>
          ) : completed ? (
            <Button variant="secondary" disabled startIcon={<CheckCircle2 className="h-4 w-4" aria-hidden />}>
              {t('requests.chat.archived')}
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
            {completed ? (
              <ContactBox contact={contact} otherName={other} serviceType={req.service_type} />
            ) : open ? (
              t('requests.chat.hint')
            ) : (
              <AlertMessage type="warning" message={t(`requests.chat.closed.${status}`, { defaultValue: t('requests.chat.closed.other') })} />
            )}
          </div>

          <div
            ref={bodyRef}
            role="log"
            aria-live="polite"
            aria-label={t('requests.chat.log')}
            onScroll={(e) => {
              const el = e.currentTarget;
              stick.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
            }}
            className="flex h-64 flex-col gap-2 overflow-y-auto rounded-lg bg-slate-100 p-3"
          >
            {messagesQ.isLoading ? (
              <CenteredSpinner />
            ) : messagesQ.isError ? (
              <p className="m-auto text-center text-xs text-red-600">{t('requests.chat.loadFailed')}</p>
            ) : messages?.length ? (
              messages.map((m) => {
                const mine = m.sender_role === role;
                return (
                  <div
                    key={m.id}
                    className={
                      mine
                        ? 'ms-auto max-w-[80%] break-words rounded-2xl bg-brand px-3 py-2 text-sm text-white'
                        : 'me-auto max-w-[80%] break-words rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800'
                    }
                    title={new Date(m.created_at).toLocaleString(i18n.language)}
                  >
                    {m.message}
                  </div>
                );
              })
            ) : (
              <p className="m-auto text-center text-xs text-slate-500">{t('requests.chat.empty')}</p>
            )}
          </div>

          {open && (
            <form onSubmit={submit} className="flex gap-2">
              <div className="flex-1">
                <TextInput
                  aria-label={t('requests.chat.placeholder')}
                  placeholder={t('requests.chat.placeholder')}
                  value={text}
                  maxLength={REQUEST_LIMITS.message}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                aria-label={t('requests.chat.send')}
                disabled={!text.trim()}
                loading={send.isPending}
                startIcon={<Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />}
              />
            </form>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={askConfirm}
        title={t('requests.chat.confirmTitle')}
        message={t('requests.chat.confirmMessage')}
        confirmLabel={t('requests.chat.confirmYes')}
        loading={confirm.isPending}
        onConfirm={doConfirm}
        onCancel={() => setAskConfirm(false)}
      />
      {askCancel && (
        <ReasonDialog open loading={cancel.isPending} onSubmit={doCancel} onClose={() => setAskCancel(false)} />
      )}
    </>
  );
}

/** The chat window of the request in `useRequestsUi.chatId`, from either side (user or provider). */
export default function ChatDialog() {
  const { t } = useTranslation();
  const chatId = useRequestsUi((s) => s.chatId);
  const close = useRequestsUi((s) => s.closeChat);
  const uid = useAuthStore((s) => s.user?.user_id);
  const requests = useMyRequests(chatId !== null);
  const req = requests.data?.find((r) => r.id === chatId);

  if (chatId === null || !uid) return null;
  if (!req)
    return (
      <Modal open onClose={close} title={t('requests.chat.titleShort')} widthClass="max-w-md">
        {requests.isLoading ? (
          <CenteredSpinner />
        ) : (
          <AlertMessage type="error" message={t('requests.chat.notFound')} />
        )}
      </Modal>
    );
  return <Chat key={chatId} req={req} uid={uid} />;
}

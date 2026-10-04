import { useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { isUnread, type AppNotification } from '@/api/notifications';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/lib/format';
import { useRequestsUi } from '@/features/requests/store';
import { notificationTarget } from './target';

const TONE: Record<string, string> = {
  success: 'border-ok-solid',
  warning: 'border-warn-solid',
  error: 'border-danger-solid',
  info: 'border-info-solid',
};

function Row({
  n,
  onOpen,
  lang,
}: {
  n: AppNotification;
  onOpen: (n: AppNotification) => void;
  lang: string;
}) {
  const unread = isUnread(n);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(n)}
        className={clsx(
          'block w-full border-s-4 px-3 py-2 text-start hover:bg-subtle',
          TONE[n.type ?? 'info'] ?? TONE.info,
          unread ? 'bg-info-soft/60' : 'opacity-70',
        )}
      >
        <span className={clsx('block text-sm text-fg', unread && 'font-bold')}>{n.title}</span>
        <span className="block text-xs text-muted">{n.message}</span>
        <span className="block text-[11px] text-muted">{formatDateTime(n.created_at, lang)}</span>
      </button>
    </li>
  );
}

interface ListProps {
  items: AppNotification[];
  isLoading: boolean;
  isError: boolean;
  onRead: (id: number) => void;
  /** Shown instead of the generic "no notifications" (e.g. an empty unread filter). */
  emptyText?: string;
  /** Called when a click leaves the list (a chat or a page opens), e.g. to close the bell dropdown. */
  onLeave?: () => void;
}

/** The full text of a notification that has nowhere to go (no link, or an older one). */
function NotificationDetail({ n, onClose, lang }: { n: AppNotification; onClose: () => void; lang: string }) {
  const { t } = useTranslation();
  const openList = useRequestsUi((s) => s.openList);
  return (
    <Modal
      open
      onClose={onClose}
      title={n.title}
      widthClass="max-w-md"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onClose();
              openList();
            }}
          >
            {t('notificationsMenu.myRequests')}
          </Button>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </>
      }
    >
      <p className="whitespace-pre-line text-sm text-fg">{n.message}</p>
      <p className="mt-3 text-xs text-muted">{formatDateTime(n.created_at, lang)}</p>
    </Modal>
  );
}

/** The rows with their loading / error / empty states — shared by the bell dropdown and the /notifications page. */
export default function NotificationList({
  items,
  isLoading,
  isError,
  onRead,
  emptyText,
  onLeave,
}: ListProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const openChat = useRequestsUi((s) => s.openChat);
  const [detail, setDetail] = useState<AppNotification | null>(null);

  // A click marks the notification read and follows its link: the request's chat, a page, or else its full text.
  const open = (n: AppNotification) => {
    if (isUnread(n)) onRead(n.id);
    const target = notificationTarget(n.link);
    if (target.kind === 'request') {
      onLeave?.();
      openChat(target.id);
    } else if (target.kind === 'page') {
      onLeave?.();
      void navigate(target.path);
    } else setDetail(n);
  };

  if (isLoading) return <CenteredSpinner minHeight="6rem" />;
  if (isError) return <p className="p-4 text-center text-xs text-danger">{t('notificationsMenu.loadFailed')}</p>;
  if (items.length === 0)
    return <p className="p-4 text-center text-xs text-muted">{emptyText ?? t('notificationsMenu.empty')}</p>;
  return (
    <>
      <ul className="divide-y divide-line">
        {items.map((n) => (
          <Row key={n.id} n={n} onOpen={open} lang={i18n.language} />
        ))}
      </ul>
      {detail && <NotificationDetail n={detail} onClose={() => setDetail(null)} lang={i18n.language} />}
    </>
  );
}

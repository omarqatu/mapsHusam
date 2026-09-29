import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { NotificationPush } from '@/api/notifications';
import { useNotificationsRealtime } from '@/api/notifications';
import { toast } from '@/components/ui/toastStore';
import { useAuthStore } from '@/store/authStore';
import ChatDialog from './ChatDialog';
import CommentDialog from './CommentDialog';
import IncomingBanner from './IncomingBanner';
import MyRequestsDialog from './MyRequestsDialog';
import RatingDialog from './RatingDialog';
import RequestFlow from './RequestFlow';
import { useRequestsRealtime } from './useRequestsRealtime';
import { useUnseen } from './unseen';

function Active({ uid, provider }: { uid: number; provider: boolean }) {
  const { t } = useTranslation();
  useEffect(() => {
    useUnseen.getState().hydrate(uid);
    return () => useUnseen.getState().hydrate(null);
  }, [uid]);

  useRequestsRealtime();

  // A pushed notification: an in-app toast, and a system notification when the tab is in the background.
  const onPush = useCallback(
    (n: NotificationPush) => {
      const text = n.title ? `${n.title} — ${n.message}` : n.message;
      toast[n.type === 'error' ? 'error' : n.type === 'warning' ? 'warning' : n.type === 'success' ? 'success' : 'info'](text);
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted')
        new Notification(n.title, { body: n.message, icon: '/favicon.ico', lang: t('app.lang') });
    },
    [t],
  );
  useNotificationsRealtime(onPush);

  return (
    <>
      {provider && <IncomingBanner />}
      <MyRequestsDialog />
      <ChatDialog />
      <RatingDialog />
      <CommentDialog />
      <RequestFlow />
    </>
  );
}

/** Mount once (App): live request events, the provider's incoming banner and every request dialog. */
export default function RequestsHost() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return <Active key={user.user_id} uid={user.user_id} provider={user.role === 'provider'} />;
}

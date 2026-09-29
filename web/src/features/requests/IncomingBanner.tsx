import { useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIncomingRequests } from '@/api/requests';
import Button from '@/components/ui/Button';
import { useRespond } from './respond';
import { useUnseen } from './unseen';
import { useRing } from './useRing';

/**
 * Provider only: the oldest waiting request as a banner with accept / reject, and how many wait behind it
 * (legacy queue). A new arrival rings once (8 s) and marks the request as new activity.
 */
export default function IncomingBanner() {
  const { t } = useTranslation();
  const incoming = useIncomingRequests(true);
  const { respond, pending, pendingId } = useRespond();
  const { play, stop } = useRing();
  const known = useRef<Set<number> | null>(null);

  const queue = incoming.data;
  useEffect(() => {
    if (!queue) return;
    const seen = (known.current ??= new Set());
    const fresh = queue.filter((r) => !seen.has(r.id));
    fresh.forEach((r) => {
      seen.add(r.id);
      useUnseen.getState().add(r.id);
    });
    if (fresh.length) play();
    if (queue.length === 0) stop();
  }, [queue, play, stop]);

  if (!queue?.length) return null;
  const req = queue[0];
  const others = queue.length - 1;
  const busy = pending && pendingId === req.id;

  return (
    <div
      role="alertdialog"
      aria-label={t('requests.incoming.title')}
      className="fixed end-4 top-16 z-[55] w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-4 shadow-xl"
    >
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-brand-fg">
        <Bell className="h-4 w-4" aria-hidden />
        {t('requests.incoming.title')}
      </p>
      <p className="mb-3 text-sm text-fg">
        {t('requests.incoming.text', { type: req.service_type || t('requests.defaultService') })}
      </p>
      {others > 0 && (
        <p className="mb-3 text-xs font-bold text-warn">{t('requests.incoming.others', { count: others })}</p>
      )}
      <div className="flex gap-2">
        <Button
          className="flex-1"
          size="sm"
          loading={busy}
          disabled={pending}
          onClick={() => respond(req, 'accept')}
        >
          {t('requests.accept')}
        </Button>
        <Button
          className="flex-1"
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() => respond(req, 'reject')}
        >
          {t('requests.reject')}
        </Button>
      </div>
    </div>
  );
}

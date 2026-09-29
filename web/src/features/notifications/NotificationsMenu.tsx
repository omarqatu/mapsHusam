import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Bell, BellRing, CheckCheck, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotifications, isUnread, type AppNotification } from '@/api/notifications';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/lib/format';

const TONE: Record<string, string> = {
  success: 'border-green-500',
  warning: 'border-amber-500',
  error: 'border-red-500',
  info: 'border-blue-500',
};

function Row({ n, onRead, lang }: { n: AppNotification; onRead: (id: number) => void; lang: string }) {
  const unread = isUnread(n);
  return (
    <li>
      <button
        type="button"
        onClick={() => unread && onRead(n.id)}
        className={clsx(
          'block w-full border-s-4 px-3 py-2 text-start hover:bg-slate-50',
          TONE[n.type ?? 'info'] ?? TONE.info,
          unread ? 'bg-blue-50/60' : 'opacity-70',
        )}
      >
        <span className={clsx('block text-sm text-slate-800', unread && 'font-bold')}>{n.title}</span>
        <span className="block text-xs text-slate-600">{n.message}</span>
        <span className="block text-[11px] text-slate-400">{formatDateTime(n.created_at, lang)}</span>
      </button>
    </li>
  );
}

/** Bell with an unread badge and a list (legacy notification dropdown). Signed-in users only. */
export default function NotificationsMenu({ tone = 'default' }: { tone?: 'default' | 'onBrand' }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { items, unread, isLoading, isError, refresh, isRefreshing, markRead, markAllRead } = useNotifications();
  const canAsk = typeof Notification !== 'undefined' && Notification.permission === 'default';

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unread ? `${t('notificationsMenu.open')} (${t('notificationsMenu.unread', { count: unread })})` : t('notificationsMenu.open')}
        title={t('notificationsMenu.open')}
        className={clsx(
          'relative inline-flex items-center rounded-lg px-2.5 py-1.5',
          tone === 'onBrand' ? 'text-white hover:bg-white/15' : 'text-slate-600 hover:bg-slate-100',
        )}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('notificationsMenu.title')}
          className="fixed inset-x-2 top-12 z-50 max-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-1 sm:w-80"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-bold">{t('notificationsMenu.title')}</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={refresh} className="rounded p-1 hover:bg-slate-100" aria-label={t('notificationsMenu.refresh')} title={t('notificationsMenu.refresh')}>
                <RefreshCw className={clsx('h-4 w-4', isRefreshing && 'animate-spin')} aria-hidden />
              </button>
              <button type="button" onClick={markAllRead} disabled={!unread} className="rounded p-1 hover:bg-slate-100 disabled:opacity-40" aria-label={t('notificationsMenu.markAll')} title={t('notificationsMenu.markAll')}>
                <CheckCheck className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          {canAsk && (
            <button
              type="button"
              onClick={() => void Notification.requestPermission().then(() => setOpen(false))}
              className="flex w-full items-center gap-2 bg-amber-50 px-3 py-2 text-start text-xs font-semibold text-amber-800"
            >
              <BellRing className="h-4 w-4" aria-hidden />
              {t('notificationsMenu.enableSystem')}
            </button>
          )}
          <div className="max-h-[55vh] overflow-y-auto">
            {isLoading ? (
              <CenteredSpinner minHeight="6rem" />
            ) : isError ? (
              <p className="p-4 text-center text-xs text-red-600">{t('notificationsMenu.loadFailed')}</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-500">{t('notificationsMenu.empty')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((n) => (
                  <Row key={n.id} n={n} onRead={markRead} lang={i18n.language} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

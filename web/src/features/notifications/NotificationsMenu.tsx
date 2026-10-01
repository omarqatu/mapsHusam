import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Bell, BellRing, CheckCheck, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useNotifications } from '@/api/notifications';
import NotificationList from './NotificationList';

/** Bell with an unread badge and a list (legacy notification dropdown). Signed-in users only. */
export default function NotificationsMenu({ tone = 'default' }: { tone?: 'default' | 'onBrand' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { items, unread, isLoading, isError, refresh, isRefreshing, markRead, markAllRead } =
    useNotifications();
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
        aria-label={
          unread
            ? `${t('notificationsMenu.open')} (${t('notificationsMenu.unread', { count: unread })})`
            : t('notificationsMenu.open')
        }
        title={t('notificationsMenu.open')}
        className={clsx(
          'relative inline-flex items-center rounded-lg px-2.5 py-1.5',
          tone === 'onBrand' ? 'text-white hover:bg-surface/15' : 'text-muted hover:bg-subtle',
        )}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full bg-danger-solid px-1 text-center text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('notificationsMenu.title')}
          className="fixed inset-x-2 top-12 z-50 max-h-[70vh] overflow-hidden rounded-xl border border-line bg-surface text-fg shadow-xl sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-1 sm:w-80"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="text-sm font-bold">{t('notificationsMenu.title')}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={refresh}
                className="rounded p-1 hover:bg-subtle"
                aria-label={t('notificationsMenu.refresh')}
                title={t('notificationsMenu.refresh')}
              >
                <RefreshCw className={clsx('h-4 w-4', isRefreshing && 'animate-spin')} aria-hidden />
              </button>
              <button
                type="button"
                onClick={markAllRead}
                disabled={!unread}
                className="rounded p-1 hover:bg-subtle disabled:opacity-40"
                aria-label={t('notificationsMenu.markAll')}
                title={t('notificationsMenu.markAll')}
              >
                <CheckCheck className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          {canAsk && (
            <button
              type="button"
              onClick={() => void Notification.requestPermission().then(() => setOpen(false))}
              className="flex w-full items-center gap-2 bg-warn-soft px-3 py-2 text-start text-xs font-semibold text-warn"
            >
              <BellRing className="h-4 w-4" aria-hidden />
              {t('notificationsMenu.enableSystem')}
            </button>
          )}
          <div className="max-h-[55vh] overflow-y-auto">
            <NotificationList items={items} isLoading={isLoading} isError={isError} onRead={markRead} />
          </div>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-3 py-2 text-center text-xs font-bold text-brand-fg hover:bg-subtle"
          >
            {t('notificationsMenu.viewAll')}
          </Link>
        </div>
      )}
    </div>
  );
}

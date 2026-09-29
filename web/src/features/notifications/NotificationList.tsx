import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { isUnread, type AppNotification } from '@/api/notifications';
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

interface ListProps {
  items: AppNotification[];
  isLoading: boolean;
  isError: boolean;
  onRead: (id: number) => void;
  /** Shown instead of the generic "no notifications" (e.g. an empty unread filter). */
  emptyText?: string;
}

/** The rows with their loading / error / empty states — shared by the bell dropdown and the /notifications page. */
export default function NotificationList({ items, isLoading, isError, onRead, emptyText }: ListProps) {
  const { t, i18n } = useTranslation();
  if (isLoading) return <CenteredSpinner minHeight="6rem" />;
  if (isError) return <p className="p-4 text-center text-xs text-red-600">{t('notificationsMenu.loadFailed')}</p>;
  if (items.length === 0)
    return <p className="p-4 text-center text-xs text-slate-500">{emptyText ?? t('notificationsMenu.empty')}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((n) => (
        <Row key={n.id} n={n} onRead={onRead} lang={i18n.language} />
      ))}
    </ul>
  );
}

import { useState } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isUnread, useNotifications } from '@/api/notifications';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import NotificationList from './NotificationList';

type Filter = 'all' | 'unread';

/** `/notifications` — the full list of the bell (legacy notifications-panel.html), with an unread filter. */
export default function NotificationsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const { items, unread, isLoading, isError, refresh, isRefreshing, markRead, markAllRead } = useNotifications();
  const shown = filter === 'unread' ? items.filter(isUnread) : items;

  return (
    <>
      <PageHeader
        title={t('nav.notifications')}
        description={unread ? t('notificationsMenu.unread', { count: unread }) : t('notificationsPage.allRead')}
        icon={<Bell className="h-6 w-6" aria-hidden />}
        actions={
          <>
            <Button
              variant="secondary"
              startIcon={<RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              onClick={refresh}
            >
              {t('notificationsMenu.refresh')}
            </Button>
            <Button startIcon={<CheckCheck className="h-4 w-4" />} onClick={markAllRead} disabled={!unread}>
              {t('notificationsMenu.markAll')}
            </Button>
          </>
        }
      />
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <Tabs
          className="m-3"
          label={t('nav.notifications')}
          idPrefix="notifications"
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: 'all', label: t('notificationsPage.all', { count: items.length }) },
            { id: 'unread', label: t('notificationsPage.unread', { count: unread }) },
          ]}
        />
        <div role="tabpanel" id={`notifications-tabpanel-${filter}`} aria-labelledby={`notifications-tab-${filter}`}>
          <NotificationList
            items={shown}
            isLoading={isLoading}
            isError={isError}
            onRead={markRead}
            emptyText={filter === 'unread' ? t('notificationsPage.noUnread') : undefined}
          />
        </div>
      </div>
    </>
  );
}

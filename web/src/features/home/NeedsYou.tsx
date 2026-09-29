import {
  Bell,
  BellRing,
  CheckCircle2,
  EyeOff,
  Hourglass,
  MessageCircle,
  MessageSquareMore,
  ShieldAlert,
  Star,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import clsx from 'clsx';
import AlertMessage from '@/components/ui/AlertMessage';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { formatNumber } from '@/lib/format';
import { openProviderPanel } from '@/features/map/provider/openPanel';
import { useRequestsUi } from '@/features/requests/store';
import type { Signal, SignalId, SignalTone } from './model';
import Pressable from './Pressable';
import { CHIP_TONE } from './tones';
import type { HomeData } from './useHomeData';

const ICON: Record<SignalId, LucideIcon> = {
  incoming: BellRing,
  unseen: MessageSquareMore,
  rate: Star,
  waiting: Hourglass,
  active: MessageCircle,
  unread: Bell,
  inactive: UserCheck,
  busy: EyeOff,
  frozen: ShieldAlert,
};
const COUNT_TONE: Record<SignalTone, string> = {
  warn: 'text-warn',
  ok: 'text-ok',
  info: 'text-info',
  danger: 'text-danger',
};

const row = clsx(
  'flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-subtle',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
);

function SignalRow({ signal }: { signal: Signal }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const Icon = ICON[signal.id];
  const to = signal.target === 'notifications' ? '/notifications' : signal.target === 'admin-users' ? '/admin/users' : undefined;
  const onClick =
    signal.target === 'requests'
      ? () => useRequestsUi.getState().openList()
      : signal.target === 'provider-panel'
        ? () => {
            openProviderPanel();
            void navigate('/');
          }
        : undefined;
  return (
    <li>
      <Pressable to={to} onClick={onClick} className={row}>
        <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', CHIP_TONE[signal.tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-fg">
          {t(`home.needs.items.${signal.id}`)}
        </span>
        {signal.count !== undefined && (
          <span className={clsx('text-xl font-black leading-none', COUNT_TONE[signal.tone])}>
            {formatNumber(signal.count, i18n.language)}
          </span>
        )}
      </Pressable>
    </li>
  );
}

function Skeleton() {
  return (
    <ul className="divide-y divide-line" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="h-10 w-10 animate-pulse rounded-xl bg-subtle-2" />
          <span className="h-4 flex-1 animate-pulse rounded bg-subtle-2" />
          <span className="h-6 w-6 animate-pulse rounded bg-subtle-2" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The "needs you" panel: only what is waiting, one line each, most urgent first. Nothing waiting is a calm message,
 * not an empty box. A failed call keeps the rows that did load and offers a retry.
 */
export default function NeedsYou({ data }: { data: HomeData }) {
  const { t } = useTranslation();
  const { signals, loading, failed, retry } = data;
  return (
    <section
      aria-labelledby="needs-you-title"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <BellRing className="h-5 w-5 text-brand-fg" aria-hidden />
        <h2 id="needs-you-title" className="flex-1 text-lg font-black text-fg">
          {t('home.needs.title')}
        </h2>
        {signals.length > 0 && (
          <Badge tone="amber" large>
            {signals.length}
          </Badge>
        )}
      </header>

      {failed && (
        <div className="space-y-2 border-b border-line p-3">
          <AlertMessage type="error" message={t('home.needs.loadFailed')} />
          <Button size="sm" variant="secondary" onClick={retry}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {loading && signals.length === 0 ? (
        <Skeleton />
      ) : signals.length > 0 ? (
        <ul className="divide-y divide-line">
          {signals.map((s) => (
            <SignalRow key={s.id} signal={s} />
          ))}
        </ul>
      ) : (
        !failed && (
          <EmptyState
            icon={<CheckCircle2 className="h-12 w-12 text-ok" aria-hidden />}
            title={t('home.needs.empty.title')}
            description={t('home.needs.empty.text')}
          />
        )
      )}
    </section>
  );
}

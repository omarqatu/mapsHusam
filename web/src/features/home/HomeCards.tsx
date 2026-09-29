import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { formatNumber } from '@/lib/format';
import { openProviderPanel } from '@/features/map/provider/openPanel';
import { useRequestsUi } from '@/features/requests/store';
import { useAuthStore } from '@/store/authStore';
import { cardsFor, type CardId } from './cards';
import HomeCard, { type CardFigure } from './HomeCard';
import type { HomeData } from './useHomeData';

/** Role-aware grid of entrances, each with the live figure where one exists. */
export default function HomeCards({ data }: { data: HomeData }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  if (!role) return null;

  const stats = data.platform;
  const num = (n: number) => formatNumber(n, i18n.language);
  const statFigure = (pick: (s: NonNullable<typeof stats.data>) => number, label: string): CardFigure | undefined =>
    stats.isLoading ? 'loading' : stats.data ? { value: num(pick(stats.data)), label } : undefined;
  const count = (n: number, label: string, tone?: 'warn'): CardFigure | undefined =>
    n > 0 ? { value: num(n), label, tone } : undefined;

  const open = data.requests.waitingReply + data.requests.active + data.requests.incoming;
  const figures: Partial<Record<CardId, CardFigure | undefined>> = {
    map: statFigure((s) => s.featuresCount, t('home.figures.features')),
    search: statFigure((s) => s.servicesCount, t('home.figures.services')),
    requests: count(open, t('home.figures.open')),
    notifications: count(data.unread, t('home.figures.unread')),
    service: data.provider
      ? data.provider === 'available'
        ? { value: t('home.figures.available'), tone: 'ok' }
        : data.provider === 'busy'
          ? { value: t('home.figures.busy'), tone: 'warn' }
          : undefined
      : undefined,
    users:
      data.inactiveUsers > 0
        ? count(data.inactiveUsers, t('home.figures.inactive'), 'warn')
        : statFigure((s) => s.usersTotal, t('home.figures.users')),
    dashboard: statFigure((s) => s.viewsTotal, t('home.figures.visits')),
  };

  const action = (id: CardId) => {
    if (id === 'requests') return () => useRequestsUi.getState().openList();
    if (id === 'service')
      return () => {
        openProviderPanel();
        void navigate('/');
      };
    return undefined;
  };

  return (
    <section aria-labelledby="home-cards-title">
      <h2 id="home-cards-title" className="mb-3 text-lg font-black text-fg">
        {t('home.cardsTitle')}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cardsFor(role).map((c) => (
          <li key={c.id} className="sm:[&:last-child:nth-child(odd)]:col-span-2">
            <HomeCard
              icon={c.icon}
              tone={c.tone}
              to={c.to}
              onClick={action(c.id)}
              title={t(`home.cards.${c.id}.title`)}
              description={t(`home.cards.${c.id}.desc`)}
              figure={figures[c.id]}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

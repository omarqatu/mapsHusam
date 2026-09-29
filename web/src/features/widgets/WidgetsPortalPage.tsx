import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Coins, CloudSun, RefreshCw, TrafficCone, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import Tabs, { type TabDef } from '@/components/ui/Tabs';
import CalendarCard from './components/CalendarCard';
import PriceCard from './components/PriceCard';
import PrayerCard from './components/PrayerCard';
import StatusCard from './components/StatusCard';
import WeatherCard from './components/WeatherCard';
import { useNow, useRefreshAll, useWidgetsData } from './hooks/useWidgets';
import {
  CARD_TAB,
  groupItems,
  groupUpdatedAt,
  isCardId,
  PORTAL_TABS,
  PRICE_GROUP,
  type CardId,
  type PortalTab,
  type PriceCardId,
} from './model';

const TAB_ICON: Record<PortalTab, ReactNode> = {
  prices: <Coins className="h-4 w-4" aria-hidden />,
  today: <CloudSun className="h-4 w-4" aria-hidden />,
  status: <TrafficCone className="h-4 w-4" aria-hidden />,
};

const PRICE_CARDS: PriceCardId[] = ['currency', 'gold', 'fuel', 'transport-inter', 'transport-intra'];
const anchor = (id: CardId) => `card-${id}`;

/** Scrolls to a card once its tab is on screen (a moment later, so the sticky header and the first data are in place). */
function useScrollToCard(card: CardId | null) {
  useEffect(() => {
    if (!card) return;
    const timer = setTimeout(() => {
      const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth';
      document.getElementById(anchor(card))?.scrollIntoView({ behavior, block: 'start' });
    }, 250);
    return () => clearTimeout(timer);
  }, [card]);
}

/**
 * `/widgets/portal` — the live information centre (legacy: the modal / phone tab behind the ticker). Ten cards in three tabs:
 * prices and fares, today (weather, prayer, calendar), and the live road / fuel-station lists. `?card=<id>` opens a card.
 */
export default function WidgetsPortalPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const wanted = params.get('card');
  const card = isCardId(wanted) ? wanted : null;
  const [tab, setTab] = useState<PortalTab>(card ? CARD_TAB[card] : 'prices');
  const [seenCard, setSeenCard] = useState(card);
  const [visited, setVisited] = useState<ReadonlySet<PortalTab>>(new Set([tab]));
  // A new deep link switches tab (adjust state while rendering — no effect needed).
  if (card !== seenCard) {
    setSeenCard(card);
    if (card && CARD_TAB[card] !== tab) setTab(CARD_TAB[card]);
  }
  if (!visited.has(tab)) setVisited(new Set(visited).add(tab));
  useScrollToCard(card);

  const now = useNow();
  const data = useWidgetsData();
  const { refresh, busy } = useRefreshAll();

  const tabs: TabDef<PortalTab>[] = PORTAL_TABS.map((id) => ({
    id,
    label: t(`widgets.tabs.${id}`),
    icon: TAB_ICON[id],
  }));
  const title = (id: CardId) => t(`widgets.cards.${id}`);

  const panel = (id: PortalTab, children: ReactNode) => (
    <div
      role="tabpanel"
      id={`widgets-tabpanel-${id}`}
      aria-labelledby={`widgets-tab-${id}`}
      hidden={tab !== id}
    >
      {(visited.has(id) || tab === id) && children}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={t('widgets.title')}
        description={t('widgets.description')}
        icon={<Zap className="h-6 w-6" aria-hidden />}
        actions={
          <Button
            variant="secondary"
            onClick={refresh}
            disabled={busy}
            startIcon={<RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />}
          >
            {t('widgets.refreshAll')}
          </Button>
        }
      />

      {data.isError && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <AlertMessage type="error" message={t('widgets.failed')} className="flex-1" />
          <Button variant="secondary" size="sm" onClick={() => void data.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      <Tabs
        className="sticky top-14 z-30 mb-4 shadow-sm"
        tabs={tabs}
        value={tab}
        onChange={setTab}
        label={t('widgets.title')}
        idPrefix="widgets"
      />

      {panel(
        'prices',
        <div className="gap-4 md:columns-2 xl:columns-3">
          {PRICE_CARDS.map((id) => (
            <PriceCard
              key={id}
              id={anchor(id)}
              className="mb-4 break-inside-avoid"
              card={id}
              title={title(id)}
              rows={groupItems(data.data, PRICE_GROUP[id])}
              updatedAt={groupUpdatedAt(data.data, PRICE_GROUP[id])}
              now={data.dataUpdatedAt}
              loading={data.isPending}
            />
          ))}
        </div>,
      )}
      {panel(
        'today',
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <WeatherCard id={anchor('weather')} title={title('weather')} className="lg:col-span-2" />
          <div className="space-y-4">
            <PrayerCard id={anchor('prayer')} title={title('prayer')} now={now} />
            <CalendarCard
              id={anchor('calendar')}
              title={title('calendar')}
              now={now}
              events={groupItems(data.data, 'events')}
              updatedAt={groupUpdatedAt(data.data, 'events')}
              dataNow={data.dataUpdatedAt}
            />
          </div>
        </div>,
      )}
      {panel(
        'status',
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <StatusCard id={anchor('road-status')} title={title('road-status')} layer="road_barriers" />
          <StatusCard id={anchor('fuel-status')} title={title('fuel-status')} layer="fuel_stations" />
        </div>,
      )}
    </div>
  );
}

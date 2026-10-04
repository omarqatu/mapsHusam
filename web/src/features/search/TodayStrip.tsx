import type { ReactNode } from 'react';
import { CloudSun, Coins, Gem, MoonStar } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMarketRates } from '@/api/market';
import { intlLocale } from '@/lib/format';
import { nextPrayer, palestineNow, weatherLabel, type CardId } from '../widgets/model';
import { useNow, usePrayerTimes, useWeather } from '../widgets/hooks/useWidgets';

function Chip({ card, icon, title, children }: { card: CardId; icon: ReactNode; title?: string; children: ReactNode }) {
  return (
    <Link
      to={`/widgets/portal?card=${card}`}
      title={title}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm text-muted transition-colors hover:bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
    >
      {icon}
      {children}
    </Link>
  );
}

const Value = ({ children }: { children: ReactNode }) => <b className="font-bold tabular-nums text-fg">{children}</b>;

/**
 * One quiet line of "today" under the search: the weather (Open-Meteo, from the browser), the next prayer (Aladhan), and the
 * world exchange rates and gold price (fetched and cached by our server). Every chip opens the information centre at its card.
 * A part whose source is down simply is not shown; with nothing to show the line is not there.
 */
export default function TodayStrip() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const now = useNow();
  const { cities } = useWeather();
  const prayer = usePrayerTimes(now).data;
  const market = useMarketRates().data;

  const city = cities[0];
  const temp = city ? weatherLabel(city) : null;
  const next = prayer ? nextPrayer(prayer, palestineNow(now).minutes) : null;
  const money = (n: number, digits: number) => n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const worldPrice = t('searchPage.today.worldPrice');
  const ils = t('searchPage.today.ils');

  const chips: ReactNode[] = [];
  if (city && temp)
    chips.push(
      <Chip key="weather" card="weather" title={t('searchPage.today.highLow')} icon={<CloudSun className="h-4 w-4 text-info" aria-hidden />}>
        {city.label || t(`widgets.cities.${city.id}`)} <Value>{temp}</Value>
      </Chip>,
    );
  if (prayer && next)
    chips.push(
      <Chip key="prayer" card="prayer" icon={<MoonStar className="h-4 w-4 text-ok" aria-hidden />}>
        {t(`widgets.prayer.${next.key}`)} <Value>{prayer[next.key]}</Value>
      </Chip>,
    );
  if (market?.rates) {
    chips.push(
      <Chip key="usd" card="currency" title={worldPrice} icon={<Coins className="h-4 w-4 text-ok" aria-hidden />}>
        {t('searchPage.today.usd')} <Value>{money(market.rates.USD_ILS, 2)}</Value> {ils}
      </Chip>,
      <Chip key="jod" card="currency" title={worldPrice} icon={<Coins className="h-4 w-4 text-ok" aria-hidden />}>
        {t('searchPage.today.jod')} <Value>{money(market.rates.JOD_ILS, 2)}</Value> {ils}
      </Chip>,
    );
  }
  if (market?.gold?.ilsPerGram21)
    chips.push(
      <Chip key="gold" card="gold" title={worldPrice} icon={<Gem className="h-4 w-4 text-warn" aria-hidden />}>
        {t('searchPage.today.gold21')} <Value>{money(market.gold.ilsPerGram21, 0)}</Value> {ils}
      </Chip>,
    );

  if (chips.length === 0) return null;
  return (
    <div
      aria-label={t('searchPage.today.title')}
      className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:justify-center md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {chips}
    </div>
  );
}

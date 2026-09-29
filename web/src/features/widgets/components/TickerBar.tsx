import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import {
  Bus,
  CalendarDays,
  CloudSun,
  Coins,
  Fuel,
  Gem,
  LayoutGrid,
  MoonStar,
  Pause,
  Play,
  TrafficCone,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatHijri, buildTickerItems, palestineNow, type CardId, type TickerItem } from '../model';
import { useNow, usePrayerTimes, useWeather, useWidgetsData } from '../hooks/useWidgets';

const ICON: Record<CardId, ReactNode> = {
  currency: <Coins className="h-4 w-4 text-emerald-700" aria-hidden />,
  gold: <Gem className="h-4 w-4 text-amber-600" aria-hidden />,
  fuel: <Fuel className="h-4 w-4 text-orange-700" aria-hidden />,
  'transport-inter': <Bus className="h-4 w-4 text-indigo-700" aria-hidden />,
  'transport-intra': <Bus className="h-4 w-4 text-violet-700" aria-hidden />,
  weather: <CloudSun className="h-4 w-4 text-sky-700" aria-hidden />,
  prayer: <MoonStar className="h-4 w-4 text-teal-700" aria-hidden />,
  calendar: <CalendarDays className="h-4 w-4 text-rose-700" aria-hidden />,
  'road-status': <TrafficCone className="h-4 w-4 text-orange-700" aria-hidden />,
  'fuel-status': <Fuel className="h-4 w-4 text-sky-700" aria-hidden />,
};

/** Seconds for one full pass: about three seconds per item, never faster than 40 s. */
const duration = (count: number) => Math.max(40, count * 3);

function Item({ item, hidden, large }: { item: TickerItem; hidden?: boolean; large: boolean }) {
  return (
    <li className={clsx('shrink-0 pe-8', hidden && 'motion-reduce:hidden')} aria-hidden={hidden || undefined}>
      <Link
        to={`/widgets/portal?card=${item.card}`}
        tabIndex={hidden ? -1 : undefined}
        className={clsx(
          'inline-flex items-center gap-2 whitespace-nowrap rounded-md py-1 text-slate-700 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand',
          large ? 'text-lg' : 'text-sm',
        )}
      >
        {ICON[item.card]}
        <span className="font-semibold" dir="auto">
          {item.label}
        </span>
        {item.value && (
          <b className="font-black text-slate-900" dir="auto">
            {item.value}
          </b>
        )}
        {item.unit && <span className="text-slate-600">{item.unit}</span>}
      </Link>
    </li>
  );
}

/**
 * The live-information ticker (legacy "تحديثات فورية" footer bar): a slow marquee of the first rows of every group —
 * exchange rates, gold, weather, fuel and fares, the next prayer, the date — and the two status lists. Each item opens the
 * information centre at its card. Pauses on hover / focus / touch and with the button; users who ask for less motion get a
 * static row they can scroll. `bar` = one slim line for the bottom of a page, `page` = the large version of /widgets/ticker.
 */
export default function TickerBar({
  variant = 'bar',
  className,
}: {
  variant?: 'bar' | 'page';
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const data = useWidgetsData();
  const { cities } = useWeather();
  const prayer = usePrayerTimes(now);
  const [paused, setPaused] = useState(false);
  const large = variant === 'page';

  const items = useMemo(
    () =>
      buildTickerItems({
        data: data.data,
        weather: cities,
        prayer: prayer.data ?? null,
        minutes: palestineNow(now).minutes,
        hijri: formatHijri(now, i18n.language),
        name: (kind, id) =>
          t(
            kind === 'card'
              ? `widgets.cards.${id}`
              : kind === 'city'
                ? `widgets.cities.${id}`
                : `widgets.prayer.${id}`,
          ),
        nextLabel: (name) => t('widgets.ticker.nextPrayer', { name }),
      }),
    [data.data, cities, prayer.data, now, i18n.language, t],
  );

  const title = t('widgets.ticker.title');
  return (
    <section
      aria-label={title}
      className={clsx(
        'flex items-center gap-2 bg-white px-3',
        large
          ? 'h-16 rounded-2xl border border-slate-200 shadow-sm'
          : 'h-10 shrink-0 border-t border-slate-200 [@media(max-height:560px)]:hidden',
        className,
      )}
    >
      <Link
        to="/widgets/portal"
        className="flex shrink-0 items-center gap-1.5 rounded-md py-1 font-black text-brand focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Zap className={large ? 'h-6 w-6' : 'h-4 w-4'} aria-hidden />
        <span className={clsx(large ? 'text-lg' : 'hidden text-sm sm:inline')}>{title}</span>
      </Link>

      <div className="ticker-viewport min-w-0 flex-1 overflow-hidden motion-reduce:overflow-x-auto">
        {data.isPending ? (
          <span className="text-sm text-slate-600">{t('widgets.ticker.loading')}</span>
        ) : items.length === 0 ? (
          <span className="text-sm text-slate-600">{t('widgets.empty')}</span>
        ) : (
          <ul
            className="ticker-track flex w-max items-center"
            style={{
              ['--ticker-dur' as string]: `${duration(items.length)}s`,
              animationPlayState: paused ? 'paused' : undefined,
            }}
          >
            {items.map((item) => (
              <Item key={item.key} item={item} large={large} />
            ))}
            {/* Second copy makes the loop seamless; screen readers and Tab skip it, reduced-motion users never see it. */}
            {items.map((item) => (
              <Item key={`copy-${item.key}`} item={item} hidden large={large} />
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPaused((v) => !v)}
        aria-pressed={paused}
        aria-label={t(paused ? 'widgets.ticker.play' : 'widgets.ticker.pause')}
        title={t(paused ? 'widgets.ticker.play' : 'widgets.ticker.pause')}
        className="shrink-0 rounded-md p-1.5 text-slate-700 hover:bg-slate-100 motion-reduce:hidden"
      >
        {paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
      </button>
      {!large && (
        <Link
          to="/widgets/portal"
          aria-label={t('widgets.ticker.open')}
          title={t('widgets.ticker.open')}
          className="shrink-0 rounded-md p-1.5 text-slate-700 hover:bg-slate-100"
        >
          <LayoutGrid className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </section>
  );
}

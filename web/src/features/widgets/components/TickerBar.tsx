import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import {
  Bus,
  CalendarDays,
  CloudSun,
  Coins,
  Fuel,
  ChevronLeft,
  Gem,
  MoonStar,
  Pause,
  Play,
  TrafficCone,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useLayerFilter, useSectionShown } from '@/features/visibility/store';
import { formatHijri, buildTickerItems, palestineNow, type CardId, type TickerItem } from '../model';
import { useTickerUi } from '../tickerStore';
import { useNow, usePrayerTimes, useWeather, useWidgetsData } from '../hooks/useWidgets';

const ICON: Record<CardId, ReactNode> = {
  currency: <Coins className="h-4 w-4 text-ok" aria-hidden />,
  gold: <Gem className="h-4 w-4 text-warn" aria-hidden />,
  fuel: <Fuel className="h-4 w-4 text-warn" aria-hidden />,
  'transport-inter': <Bus className="h-4 w-4 text-info" aria-hidden />,
  'transport-intra': <Bus className="h-4 w-4 text-brand-fg" aria-hidden />,
  weather: <CloudSun className="h-4 w-4 text-info" aria-hidden />,
  prayer: <MoonStar className="h-4 w-4 text-ok" aria-hidden />,
  calendar: <CalendarDays className="h-4 w-4 text-danger" aria-hidden />,
  'road-status': <TrafficCone className="h-4 w-4 text-warn" aria-hidden />,
  'fuel-status': <Fuel className="h-4 w-4 text-info" aria-hidden />,
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
          'inline-flex items-center gap-2 whitespace-nowrap rounded-md py-1 text-fg hover:text-brand-fg focus-visible:outline-2 focus-visible:outline-brand',
          large ? 'text-lg' : 'text-sm',
        )}
      >
        {ICON[item.card]}
        <span className="font-semibold" dir="auto">
          {item.label}
        </span>
        {item.value && (
          <b className="font-black text-fg" dir="auto">
            {item.value}
          </b>
        )}
        {item.unit && <span className="text-muted">{item.unit}</span>}
      </Link>
    </li>
  );
}

/** Seconds each item stays on a phone, where one item at a time replaces the marquee. */
const ROTATE_MS = 4000;

/**
 * Phones: a marquee across 300 px is unreadable (an item is gone before it is read), so one item shows at a time and the
 * next one fades in every few seconds. Stops with the pause button, and while a finger or the keyboard is on it.
 */
function OneAtATime({ items, paused }: { items: TickerItem[]; paused: boolean }) {
  const [index, setIndex] = useState(0);
  const [holding, setHolding] = useState(false);
  const several = items.length > 1;
  // Not restarted when the list grows (weather and prayer times arrive later): the current item keeps its full time.
  useEffect(() => {
    if (paused || holding || !several) return;
    const id = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, holding, several]);
  const item = items[index % items.length];
  return (
    <div
      onPointerEnter={() => setHolding(true)}
      onPointerLeave={() => setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={() => setHolding(false)}
    >
      {/* A new list per item: remounting replays the fade-in. */}
      <ul key={item.key} className="flex min-w-0 items-center motion-safe:animate-[rise_0.4s_ease-out_both]">
        <Item item={item} large={false} />
      </ul>
    </div>
  );
}

/**
 * The live-information ticker (legacy "تحديثات فورية" footer bar): a slow marquee of the first rows of every group —
 * exchange rates, gold, weather, fuel and fares, the next prayer, the date — and the two status lists. Each item opens the
 * information centre at its card. Pauses on hover / focus / touch and with the button; users who ask for less motion get a
 * static row they can scroll. `bar` = one slim line for the bottom of a page, `page` = the large version of /widgets/ticker.
 * `collapsible` (the map): a glass strip glued to the bottom edge of the page, over the map; its arrow points to the corner it folds
 * into (the start side), where it becomes a small tab that the same arrow, reversed, unfolds again.
 */
export default function TickerBar({
  variant = 'bar',
  collapsible = false,
  className,
}: {
  variant?: 'bar' | 'page';
  /** On the map (place it inside the map's `relative` box): glass strip that can fold into a small tab at the start corner (remembered). */
  collapsible?: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const data = useWidgetsData();
  const { cities } = useWeather();
  const prayer = usePrayerTimes(now);
  const [paused, setPaused] = useState(false);
  const hidden = useTickerUi((s) => s.hidden);
  const setHidden = useTickerUi((s) => s.setHidden);
  const large = variant === 'page';
  const stripOn = useSectionShown('ticker');
  const layerShown = useLayerFilter();
  // One item at a time on phones (`max-sm`), unless the user asked for less motion (then the static row, as elsewhere).
  const phone = useMediaQuery('(max-width: 639.98px)', false);
  const lessMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false);
  const oneAtATime = phone && !lessMotion && !large;

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
      }).filter(
        // road / fuel status follow their layers (hidden by the admin → not advertised here either)
        (i) =>
          (i.card !== 'road-status' || layerShown('road_barriers')) &&
          (i.card !== 'fuel-status' || layerShown('fuel_stations')),
      ),
    [data.data, cities, prayer.data, now, i18n.language, t, layerShown],
  );

  // The admin can switch the strip off (map, search page); the full-page version (/widgets/ticker) stays.
  if (!stripOn && !large) return null;

  const title = t('widgets.ticker.title');
  if (collapsible && hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        aria-label={t('widgets.ticker.show')}
        title={t('widgets.ticker.show')}
        className="glass-bar absolute bottom-0 start-0 z-10 inline-flex h-9 items-center gap-1.5 rounded-t-xl border-e ps-3 pe-2.5 text-sm font-bold text-brand-fg focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Zap className="h-4 w-4" aria-hidden />
        <span className="max-sm:hidden">{title}</span>
        <ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
      </button>
    );
  }
  return (
    <section
      aria-label={title}
      className={clsx(
        'flex items-center gap-2 px-3',
        collapsible &&
          'glass-bar absolute inset-x-0 bottom-0 z-10 h-10 rounded-t-2xl [@media(max-height:560px)]:hidden',
        !collapsible && 'bg-surface',
        large && 'h-16 rounded-2xl border border-line shadow-sm',
        !collapsible && !large && 'h-10 shrink-0 border-t border-line [@media(max-height:560px)]:hidden',
        className,
      )}
    >
      {collapsible && (
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label={t('widgets.ticker.hide')}
          title={t('widgets.ticker.hide')}
          className="shrink-0 rounded-md p-1.5 text-fg hover:bg-subtle"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </button>
      )}
      <Link
        to="/widgets/portal"
        aria-label={title}
        className="flex shrink-0 items-center gap-1.5 rounded-md py-1 font-black text-brand-fg focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Zap className={large ? 'h-6 w-6' : 'h-4 w-4'} aria-hidden />
        <span className={clsx(large ? 'text-lg' : 'hidden text-sm sm:inline')}>{title}</span>
      </Link>

      <div className="ticker-viewport min-w-0 flex-1 overflow-hidden motion-reduce:overflow-x-auto">
        {data.isPending ? (
          <span className="text-sm text-muted">{t('widgets.ticker.loading')}</span>
        ) : items.length === 0 ? (
          <span className="text-sm text-muted">{t('widgets.empty')}</span>
        ) : oneAtATime ? (
          <OneAtATime items={items} paused={paused} />
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
        className="shrink-0 rounded-md p-1.5 text-fg hover:bg-subtle motion-reduce:hidden"
      >
        {paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
      </button>
    </section>
  );
}

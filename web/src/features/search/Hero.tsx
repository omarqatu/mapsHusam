import { Fuel, Map as MapIcon, Signpost } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { usePlatformStats } from '@/api/platform';
import { formatNumber } from '@/lib/format';

interface Props {
  onRoads: () => void;
  onFuel: () => void;
}

const action =
  'inline-flex h-10 items-center gap-2 rounded-lg bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25';

/** Intro block (legacy "how to search" hero): text, platform counters, map link and the two live-status shortcuts. */
export default function Hero({ onRoads, onFuel }: Props) {
  const { t, i18n } = useTranslation();
  const stats = usePlatformStats();
  const s = stats.data;
  const tiles: [string, number][] = s
    ? [
        [t('extras.stats.users'), s.usersTotal],
        [t('extras.stats.providers'), s.featuresCount],
        [t('extras.stats.viewsTotal'), s.viewsTotal],
      ]
    : [];
  return (
    <section className="rounded-2xl bg-gradient-to-l from-brand to-brand-2 p-5 text-white shadow-md md:p-7">
      <h1 className="text-2xl font-black md:text-3xl">{t('searchPage.heroTitle')}</h1>
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-white/95">{t('searchPage.heroText')}</p>
      {tiles.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label={t('extras.tabs.stats')}>
          {tiles.map(([label, value]) => (
            <li key={label} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm">
              <b className="text-base">{formatNumber(value, i18n.language)}</b> {label}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/" className={action}>
          <MapIcon className="h-4 w-4" aria-hidden /> {t('searchPage.goToMap')}
        </Link>
        <button type="button" onClick={onRoads} className={action}>
          <Signpost className="h-4 w-4" aria-hidden /> {t('extras.tabs.roads')}
        </button>
        <button type="button" onClick={onFuel} className={action}>
          <Fuel className="h-4 w-4" aria-hidden /> {t('extras.tabs.fuel')}
        </button>
      </div>
    </section>
  );
}

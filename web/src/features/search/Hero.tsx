import { Layers, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlatformStats } from '@/api/platform';
import { formatNumber } from '@/lib/format';

/** Intro block (legacy "how to search" hero): the text and the two figures that matter — providers and services. */
export default function Hero() {
  const { t, i18n } = useTranslation();
  const s = usePlatformStats().data;
  const tiles = s
    ? [
        { icon: MapPin, value: s.featuresCount, label: t('extras.stats.providers') },
        { icon: Layers, value: s.servicesCount, label: t('extras.stats.services') },
      ]
    : [];
  return (
    <section className="rounded-2xl bg-gradient-to-l from-brand to-brand-2 p-5 text-white shadow-md md:p-7">
      <h1 className="text-2xl font-black md:text-3xl">{t('searchPage.heroTitle')}</h1>
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-white/95">{t('searchPage.heroText')}</p>
      {tiles.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-3" aria-label={t('extras.tabs.stats')}>
          {tiles.map(({ icon: Icon, value, label }) => (
            <li key={label} className="flex min-w-36 items-center gap-3 rounded-xl bg-surface/15 px-4 py-2.5">
              <Icon className="h-6 w-6 text-white/90" aria-hidden />
              <span>
                <b className="block text-2xl leading-none">{formatNumber(value, i18n.language)}</b>
                <span className="text-sm text-white/90">{label}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

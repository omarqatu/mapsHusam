import { Layers, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/format';
import type { HomeData } from './useHomeData';

/** Slim row under the page: how big the platform is (the two figures visitors ask about). Quiet on failure. */
export default function PlatformFigures({ platform }: { platform: HomeData['platform'] }) {
  const { t, i18n } = useTranslation();
  const s = platform.data;
  const items = s
    ? [
        { icon: MapPin, value: s.featuresCount, label: t('extras.stats.providers') },
        { icon: Layers, value: s.servicesCount, label: t('extras.stats.services') },
      ]
    : [];
  return (
    <section
      aria-label={t('home.platform.title')}
      className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card"
    >
      <h2 className="text-sm font-bold text-muted">{t('home.platform.title')}</h2>
      {platform.isLoading && <span className="h-6 w-56 animate-pulse rounded bg-subtle-2" aria-hidden />}
      {platform.isError && (
        <p className="flex items-center gap-3 text-sm text-muted">
          {t('home.platform.failed')}
          <button
            type="button"
            onClick={() => void platform.refetch()}
            className="font-semibold text-brand-fg underline underline-offset-2"
          >
            {t('common.retry')}
          </button>
        </p>
      )}
      {items.map(({ icon: Icon, value, label }) => (
        <p key={label} className="flex items-center gap-2 text-sm text-muted">
          <Icon className="h-4 w-4 text-brand-fg" aria-hidden />
          <b className="text-lg font-black text-fg">{formatNumber(value, i18n.language)}</b>
          {label}
        </p>
      ))}
    </section>
  );
}

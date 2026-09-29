import { ArrowLeft, Building2, KeyRound, LandPlot, Layers, MapPin, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlatformStats } from '@/api/platform';
import { formatNumber } from '@/lib/format';
import { targetLabelKey, type MapTarget } from '../map/targets';
import type { RealEstateLayerKey } from '../map/config';

const TILES: { layer: RealEstateLayerKey; icon: LucideIcon }[] = [
  { layer: 'rent', icon: KeyRound },
  { layer: 'sale', icon: Building2 },
  { layer: 'land', icon: LandPlot },
];

/**
 * The top of the page is about property: what people mostly come for. Three large doors (rent, sale, land) that open the
 * filtered list; the two platform figures sit underneath as a quiet line. Services follow below the fold.
 */
export default function Hero({ onPick }: { onPick: (t: MapTarget) => void }) {
  const { t, i18n } = useTranslation();
  const s = usePlatformStats().data;
  const stats = s
    ? [
        { icon: MapPin, value: s.featuresCount, label: t('extras.stats.providers') },
        { icon: Layers, value: s.servicesCount, label: t('extras.stats.services') },
      ]
    : [];
  return (
    <section>
      <div>
        <h1 className="text-xl font-black text-fg md:text-2xl">{t('searchPage.heroTitle')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted max-sm:hidden">{t('searchPage.heroText')}</p>

        <ul className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {TILES.map(({ layer, icon: Icon }) => {
            const target: MapTarget = { kind: 'realEstate', layer };
            return (
              <li key={layer}>
                <button
                  type="button"
                  onClick={() => onPick(target)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-float focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-fg transition group-hover:bg-brand group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-base text-fg">{t(targetLabelKey(target))}</b>
                    <span className="text-sm text-muted">{t(`searchPage.reHint_${layer}`)}</span>
                  </span>
                  <ArrowLeft
                    className="h-4 w-4 shrink-0 text-muted rtl:rotate-0 ltr:rotate-180"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>

        {stats.length > 0 && (
          <ul
            className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted"
            aria-label={t('extras.tabs.stats')}
          >
            {stats.map(({ icon: Icon, value, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4" aria-hidden />
                <b className="text-fg">{formatNumber(value, i18n.language)}</b> {label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

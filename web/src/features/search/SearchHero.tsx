import { useTranslation } from 'react-i18next';
import { usePlatformStats } from '@/api/platform';
import { useExcludedLayers, useSectionShown } from '@/features/visibility/store';
import { formatNumber } from '@/lib/format';
import { targetLabelKey, type MapTarget } from '../map/targets';
import HeroBackdrop from './HeroBackdrop';
import KeywordSearch from './KeywordSearch';
import { usePopularTargets } from './popular';

interface Props {
  term: string;
  onCommit: (term: string) => void;
  onPick: (t: MapTarget) => void;
  /** Where the sticky search watches from: this element leaving the screen shows it. */
  searchRef: React.Ref<HTMLDivElement>;
}

/**
 * The top of the landing (legacy hero: how to search, the platform figures): the promise, the big search, popular types one
 * tap away and three figures, centred on a light animated backdrop (no photo: the search stays the only thing to look at).
 */
export default function SearchHero({ term, onCommit, onPick, searchRef }: Props) {
  const { t, i18n } = useTranslation();
  const statsOn = useSectionShown('stats');
  const s = usePlatformStats(statsOn, useExcludedLayers()).data;
  const n = (v: number | undefined) => (v === undefined ? '—' : formatNumber(v, i18n.language));
  const figures = [
    { value: s?.featuresCount, label: t('searchPage.statProviders') },
    { value: s?.servicesCount, label: t('searchPage.statServices') },
    { value: s?.viewsTotal, label: t('searchPage.statVisits') },
  ].filter((f) => f.value !== 0); // a real 0 ("0 visits") reads as a dead platform; unknown still shows "—"

  const popular = usePopularTargets();

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-sm motion-safe:animate-[rise_0.5s_ease-out_both]">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-2xl space-y-4 px-5 py-8 text-center md:py-14">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1 text-xs font-bold text-brand-fg">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
          {t('searchPage.kicker')}
        </p>
        <h1 className="text-3xl font-black leading-[1.25] text-balance text-fg md:text-[2.6rem]">
          {t('searchPage.heroLine1')}{' '}
          <span className="whitespace-nowrap bg-gradient-to-l from-brand-fg to-brand-2-fg bg-clip-text text-transparent">
            {t('searchPage.heroLine2')}
          </span>
        </h1>
        <p className="mx-auto max-w-md text-base text-muted">{t('searchPage.heroText')}</p>

        <div ref={searchRef} className="text-start">
          <KeywordSearch value={term} onCommit={onCommit} large />
        </div>

        <div className="-mx-5 flex items-center gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-sm text-muted">{t('searchPage.popular')}</span>
          {popular.map((x) => (
            <button
              key={x.kind === 'service' ? x.discriminator : x.layer}
              type="button"
              onClick={() => onPick(x)}
              className="h-8 shrink-0 rounded-full border border-line bg-surface/80 px-3 text-sm font-semibold text-fg backdrop-blur transition-colors hover:border-brand hover:bg-brand-light hover:text-brand-fg"
            >
              {t(targetLabelKey(x))}
            </button>
          ))}
        </div>

        {/* Fixed height before the figures arrive: nothing below moves. Off when the admin hides the statistics. */}
        {statsOn && (
          <dl className="mx-auto grid max-w-md auto-cols-fr grid-flow-col divide-x divide-line pt-2">
            {figures.map((f) => (
              <div key={f.label} className="px-3">
                <dd className="text-xl font-black text-fg">{n(f.value)}</dd>
                <dt className="text-xs text-muted">{f.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { useCategoryCounts } from '@/api/platform';
import { formatNumber } from '@/lib/format';
import { groupLabelKey } from '../map/registry';
import { targetIcon, targetLabelKey, targetToApi, type MapTarget } from '../map/targets';
import { GROUP_ART } from './art';
import { GROUP_ICON, GROUP_IDS, targetsInGroup, type GroupId } from './categories';

type Section = Exclude<GroupId, 'all'>;

interface Props {
  onGroup: (g: GroupId) => void;
  onPick: (t: MapTarget) => void;
}

/** Cards rise in one after another on the first paint (skipped with "reduce motion"). */
const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 45}ms` });
const riseClass = 'motion-safe:animate-[rise_0.5s_ease-out_both]';

/**
 * The sections as a mosaic of picture cards (the platform's own illustrations, cropped to their drawing side so the
 * text printed on them stays out): property is the big tile with its three kinds one tap away; the other illustrated
 * sections are square tiles; sections without a picture follow as a line of
 * small cards. A tile opens its section (a one-type section opens its list directly).
 */
export default function Collections({ onGroup, onPick }: Props) {
  const { t, i18n } = useTranslation();
  const counts = useCategoryCounts().data;
  const sections = GROUP_IDS.filter((g): g is Section => g !== 'all');
  const pictured = sections.filter((g) => g !== 'realestate' && GROUP_ART[g]);
  const plain = sections.filter((g) => !GROUP_ART[g]);
  const property = targetsInGroup('realestate');

  const cover = 'absolute inset-0 h-full w-full object-cover object-left-bottom transition duration-500 group-hover:scale-105';
  const shade = 'absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent';
  // Listings on show per type (server: cached a minute). Until they arrive, or if the request fails, the cards have no number.
  const listings = (list: MapTarget[]) => (counts ? list.reduce((sum, x) => sum + (counts[targetToApi(x).layer] ?? 0), 0) : null);
  const badge = 'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums';
  const count = (g: Section) => {
    const n = listings(targetsInGroup(g));
    return n === null ? null : (
      <span className={`${badge} bg-white/20 text-white ring-1 ring-white/30 backdrop-blur`}>{formatNumber(n, i18n.language)}</span>
    );
  };

  return (
    <section aria-labelledby="sections-title" className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 id="sections-title" className="text-xl font-black text-fg">
            {t('searchPage.sectionsTitle')}
          </h2>
          <p className="text-sm text-muted">{t('searchPage.sectionsHint')}</p>
        </div>
      </div>

      <ul className="grid auto-rows-[9.5rem] grid-cols-2 gap-3 md:auto-rows-[11rem] md:grid-cols-4">
        {/* Property: the big tile, its three kinds as buttons on the picture. */}
        <li className={clsx('group relative col-span-2 row-span-2 overflow-hidden rounded-3xl bg-brand-light', riseClass)} style={rise(0)}>
          <img src={GROUP_ART.realestate} alt="" className={cover} />
          <div className={shade} />
          <button
            type="button"
            onClick={() => onGroup('realestate')}
            className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
            aria-label={t(groupLabelKey('realestate'))}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-3 p-4 md:p-5">
            <div>
              <p className="text-xs font-bold tracking-wide text-white/80">{t('searchPage.propertyKicker')}</p>
              <h3 className="text-2xl font-black text-white md:text-3xl">{t(groupLabelKey('realestate'))}</h3>
            </div>
            <div className="pointer-events-auto flex flex-wrap gap-2">
              {property.map((x) => (
                <button
                  key={t(targetLabelKey(x))}
                  type="button"
                  onClick={() => onPick(x)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface/95 px-4 text-sm font-bold text-fg shadow-sm transition hover:bg-surface hover:shadow-float focus-visible:outline-2 focus-visible:outline-white"
                >
                  <span aria-hidden>{targetIcon(x)}</span> {t(targetLabelKey(x))}
                  {counts && <span className="text-xs font-semibold tabular-nums text-muted">{formatNumber(listings([x]) ?? 0, i18n.language)}</span>}
                </button>
              ))}
            </div>
          </div>
        </li>

        {pictured.map((g, i) => (
          // An odd count leaves a hole in the last row: the last tile takes two columns (2 per row on phones, 4 wide).
          <li
            key={g}
            className={clsx('relative', riseClass, i === pictured.length - 1 && pictured.length % 2 === 1 && 'col-span-2')}
            style={rise(i + 1)}
          >
            <button
              type="button"
              onClick={() => onGroup(g)}
              className="group relative block h-full w-full overflow-hidden rounded-2xl bg-brand-light text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <img src={GROUP_ART[g]} alt="" loading="lazy" className={cover} />
              <span className={shade} />
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
                <span className="text-base font-black leading-tight text-white">{t(groupLabelKey(g))}</span>
                {count(g)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Sections without a picture: one line of small cards (most of them open a single list). */}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {plain.map((g, i) => {
          const Icon = GROUP_ICON[g];
          return (
            <li
              key={g}
              className={clsx(riseClass, i === plain.length - 1 && plain.length % 2 === 1 && 'max-sm:col-span-2')}
              style={rise(pictured.length + 1 + i)}
            >
              <button
                type="button"
                onClick={() => onGroup(g)}
                className="group flex h-full w-full items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 text-start text-sm font-bold text-fg shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-float focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand-fg transition group-hover:bg-brand group-hover:text-white" aria-hidden>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1 leading-tight">{t(groupLabelKey(g))}</span>
                {counts && (
                  <span className={`${badge} bg-subtle-2 text-muted`}>{formatNumber(listings(targetsInGroup(g)) ?? 0, i18n.language)}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import SearchInput from '@/components/ui/SearchInput';
import { matchesQuery } from '../map/extras/status';
import { groupLabelKey } from '../map/registry';
import { targetIcon, targetKey, targetLabelKey, type MapTarget } from '../map/targets';
import { useLayerFilter } from '@/features/visibility/store';
import { GROUP_ICON, targetsInGroup, useShownGroupIds, type GroupId } from './categories';

interface Props {
  group: GroupId;
  onGroup: (g: GroupId) => void;
  onPick: (t: MapTarget) => void;
}

/** "All" is 70 types: show the first rows (property comes first) and let the rest unfold. */
const ALL_PREVIEW = 12;

/**
 * Legacy layout: a line of group tabs (icon + name, the open one underlined) and, under it, the types of that group as
 * icon tiles. "All" opens on the property types. Typing in the filter box lists matching types from every group.
 */
export default function CategoryBrowser({ group, onGroup, onPick }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const activeTab = useRef<HTMLButtonElement>(null);

  // A deep link (?group=health) can point at a tab that is scrolled out of the line.
  useEffect(() => {
    activeTab.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [group]);

  const layerShown = useLayerFilter();
  const groupIds = useShownGroupIds();
  const searching = query.trim() !== '';
  const targets = useMemo(
    () =>
      targetsInGroup(searching ? 'all' : group, layerShown).filter(
        (x) => !searching || matchesQuery(t(targetLabelKey(x)), query),
      ),
    [group, query, searching, t, layerShown],
  );
  const preview = group === 'all' && !searching && !expanded;
  const shown = preview ? targets.slice(0, ALL_PREVIEW) : targets;

  return (
    <section aria-labelledby="categories-title" className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 id="categories-title" className="text-lg font-black text-fg">
          {t('searchPage.chooseCategory')}
        </h2>
        <SearchInput value={query} onChange={setQuery} debounceMs={150} placeholder={t('search.filterTypes')} className="md:w-56" />
      </div>

      <div
        role="group"
        aria-label={t('searchPage.groups')}
        className="-mx-4 flex overflow-x-auto border-b border-line px-4 [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)] [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {groupIds.map((g) => {
          const Icon = GROUP_ICON[g];
          const on = g === group && !searching;
          return (
            <button
              key={g}
              ref={g === group ? activeTab : undefined}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setQuery('');
                onGroup(g);
              }}
              className={clsx(
                '-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
                on ? 'border-brand text-brand-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(g === 'all' ? 'searchPage.allGroups' : groupLabelKey(g))}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl bg-surface p-4 text-sm text-muted">{t('searchPage.noCategories')}</p>
      ) : (
        <ul className="grid auto-rows-fr grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((x) => (
            <li key={targetKey(x)}>
              <button
                type="button"
                onClick={() => onPick(x)}
                className="group flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-brand hover:shadow-float focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-light text-2xl leading-none transition group-hover:bg-brand"
                >
                  {targetIcon(x)}
                </span>
                <span className="line-clamp-2 text-sm font-semibold leading-tight text-fg">{t(targetLabelKey(x))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {preview && targets.length > ALL_PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mx-auto flex h-10 items-center rounded-full border border-line-strong bg-surface px-5 text-sm font-semibold text-fg hover:border-brand hover:bg-brand-light"
        >
          {t('searchPage.showAllTypes', { count: targets.length - ALL_PREVIEW })}
        </button>
      )}
    </section>
  );
}

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import SearchInput from '@/components/ui/SearchInput';
import { matchesQuery } from '../map/extras/status';
import { groupLabelKey } from '../map/registry';
import { targetIcon, targetKey, targetLabelKey, type MapTarget } from '../map/targets';
import { GROUP_ICON, GROUP_IDS, targetsInGroup, type GroupId } from './categories';

interface Props {
  group: GroupId;
  onGroup: (g: GroupId) => void;
  onPick: (t: MapTarget) => void;
}

/**
 * Services, kept short: "all" shows only the 13 groups (legacy "branches") as compact cards — a group opens its types under a
 * one-line tab row. Typing in the filter box lists matching types from every group at once.
 */
export default function CategoryBrowser({ group, onGroup, onPick }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const targets = useMemo(
    // Property has its own doors at the top of the page; the "all" grid lists services only.
    () =>
      targetsInGroup(group).filter(
        (x) => (group !== 'all' || x.kind !== 'realEstate') && matchesQuery(t(targetLabelKey(x)), query),
      ),
    [group, query, t],
  );

  const groupsView = group === 'all' && !query.trim();
  const groupIds = GROUP_IDS.filter((g) => g !== 'all');
  const tile =
    'group flex h-full w-full items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5 text-start text-sm font-semibold text-fg transition hover:border-brand hover:shadow-float focus-visible:outline-2 focus-visible:outline-brand';
  const circle =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-fg text-lg leading-none transition group-hover:bg-brand group-hover:text-white';

  return (
    <section aria-labelledby="categories-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="categories-title" className="text-lg font-black text-fg">
            {t('searchPage.servicesTitle')}
          </h2>
          <p className="text-sm text-muted">{t('searchPage.servicesHint')}</p>
        </div>
        <div className="w-full sm:w-64">
          <SearchInput
            value={query}
            onChange={setQuery}
            debounceMs={150}
            placeholder={t('search.filterTypes')}
          />
        </div>
      </div>

      {group !== 'all' && (
        <div
          role="group"
          aria-label={t('searchPage.groups')}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {GROUP_IDS.map((g) => {
            const Icon = GROUP_ICON[g];
            const on = g === group;
            return (
              <button
                key={g}
                type="button"
                aria-pressed={on}
                onClick={() => onGroup(g)}
                className={clsx(
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                  on
                    ? 'border-brand bg-brand text-white'
                    : 'border-line-strong bg-surface text-fg hover:border-brand hover:bg-brand-light',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t(g === 'all' ? 'searchPage.allGroups' : groupLabelKey(g))}
              </button>
            );
          })}
        </div>
      )}

      {groupsView ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {groupIds.map((g) => {
            const Icon = GROUP_ICON[g];
            const count = targetsInGroup(g).length;
            return (
              <li key={g}>
                <button type="button" onClick={() => onGroup(g)} className={tile}>
                  <span aria-hidden className={circle}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t(groupLabelKey(g))}</span>
                  <span className="text-xs font-normal text-muted">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : targets.length === 0 ? (
        <p className="rounded-xl bg-surface p-4 text-sm text-muted">{t('searchPage.noCategories')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {targets.map((x) => (
            <li key={targetKey(x)}>
              <button type="button" onClick={() => onPick(x)} className={tile}>
                <span aria-hidden className={circle}>
                  {targetIcon(x)}
                </span>
                <span className="min-w-0 flex-1">{t(targetLabelKey(x))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

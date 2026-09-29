import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import SearchInput from '@/components/ui/SearchInput';
import { matchesQuery } from '../map/extras/status';
import { targetIcon, targetKey, targetLabelKey, type MapTarget } from '../map/targets';
import { GROUP_ICON, GROUP_IDS, targetsInGroup, type GroupId } from './categories';

interface Props {
  group: GroupId;
  onGroup: (g: GroupId) => void;
  onPick: (t: MapTarget) => void;
}

/** Group tabs (legacy "branches") + the grid of types inside the chosen group. */
export default function CategoryBrowser({ group, onGroup, onPick }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const targets = useMemo(
    () => targetsInGroup(group).filter((x) => matchesQuery(t(targetLabelKey(x)), query)),
    [group, query, t],
  );

  return (
    <section aria-labelledby="categories-title" className="space-y-3">
      <h2 id="categories-title" className="text-lg font-bold text-fg">
        {t('searchPage.chooseCategory')}
      </h2>

      <div
        role="group"
        aria-label={t('searchPage.groups')}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
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
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors',
                on
                  ? 'border-brand bg-brand text-white'
                  : 'border-line-strong bg-surface text-fg hover:border-brand hover:bg-brand-light',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(g === 'all' ? 'searchPage.allGroups' : `extras.featured.groups.${g}`)}
            </button>
          );
        })}
      </div>

      <div className="max-w-md">
        <SearchInput
          value={query}
          onChange={setQuery}
          debounceMs={150}
          placeholder={t('search.filterTypes')}
        />
      </div>

      {targets.length === 0 ? (
        <p className="rounded-xl bg-surface p-4 text-sm text-muted">{t('searchPage.noCategories')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {targets.map((x) => (
            <li key={targetKey(x)}>
              <button
                type="button"
                onClick={() => onPick(x)}
                className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-surface p-3 text-center text-sm font-semibold text-fg shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
              >
                <span aria-hidden className="text-3xl leading-none">
                  {targetIcon(x)}
                </span>
                <span>{t(targetLabelKey(x))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

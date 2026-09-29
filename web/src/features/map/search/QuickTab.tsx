import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import SearchInput from '@/components/ui/SearchInput';
import { SERVICE_TYPE_BY_KEY } from '../config';
import { ALL_TARGETS, targetKey, targetLabelKey, type SearchTarget } from './model';
import { useSearchUi } from './store';
import { useSearchActions } from './useSearchActions';

const REAL_ESTATE_ICON: Record<string, string> = { rent: '🏠', sale: '🏡', land: '🟥' };
const iconOf = (t: SearchTarget) =>
  t.kind === 'realEstate'
    ? REAL_ESTATE_ICON[t.layer]
    : (SERVICE_TYPE_BY_KEY.get(t.discriminator)?.icon ?? '📍');

/** Quick search: tap a type → everything of that type in the part of the map you are looking at. */
export default function QuickTab() {
  const { t } = useTranslation();
  const actions = useSearchActions();
  const busy = useSearchUi((s) => s.busy);
  const [filter, setFilter] = useState('');

  const items = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const all = ALL_TARGETS.map((x) => ({ x, label: t(targetLabelKey(x)) }));
    return q ? all.filter((i) => i.label.toLowerCase().includes(q)) : all;
  }, [filter, t]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{t('search.quickHint')}</p>
      <SearchInput value={filter} onChange={setFilter} placeholder={t('search.filterTypes')} debounceMs={0} />
      <div className="flex flex-wrap gap-2">
        {items.map(({ x, label }) => (
          <button
            key={targetKey(x)}
            type="button"
            disabled={busy}
            onClick={() => void actions.quick(x)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700',
              'hover:border-brand hover:bg-brand-light disabled:opacity-60',
            )}
          >
            <span aria-hidden>{iconOf(x)}</span>
            {label}
          </button>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-500">{t('common.noData')}</p>}
      </div>
    </div>
  );
}

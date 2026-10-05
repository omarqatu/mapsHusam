import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import SearchInput from '@/components/ui/SearchInput';

import { useShownTargets } from '@/features/visibility/store';
import { targetKey, targetLabelKey } from '../targets';
import { useSearchUi } from './store';
import { useSearchActions } from './useSearchActions';
import TargetIcon from '../TargetIcon';

/** Quick search: tap a type → everything of that type in the part of the map you are looking at. */
export default function QuickTab() {
  const { t } = useTranslation();
  const actions = useSearchActions();
  const busy = useSearchUi((s) => s.busy);
  const [filter, setFilter] = useState('');
  const targets = useShownTargets();

  const items = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const all = targets.map((x) => ({ x, label: t(targetLabelKey(x)) }));
    return q ? all.filter((i) => i.label.toLowerCase().includes(q)) : all;
  }, [filter, t, targets]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t('search.quickHint')}</p>
      <SearchInput value={filter} onChange={setFilter} placeholder={t('search.filterTypes')} debounceMs={0} />
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ x, label }) => (
          <button
            key={targetKey(x)}
            type="button"
            disabled={busy}
            onClick={() => void actions.quick(x)}
            className={clsx(
              'flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2 text-start text-sm font-semibold text-fg',
              'hover:border-brand hover:bg-brand-light disabled:opacity-60',
            )}
          >
            <span aria-hidden className="text-lg">
              <TargetIcon target={x} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">{label}</span>
          </button>
        ))}
        {items.length === 0 && <p className="col-span-2 text-sm text-muted">{t('common.noData')}</p>}
      </div>
    </div>
  );
}

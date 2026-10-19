import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import SearchInput from '@/components/ui/SearchInput';

import { useShownTargets } from '@/features/visibility/store';
import { groupLabelKey } from '../registry';
import { GROUP_ICON } from '../registry/groupIcons';
import { targetKey, targetLabelKey, type MapTarget } from '../targets';
import { useSearchUi } from './store';
import { useSearchActions } from './useSearchActions';
import TargetIcon from '../TargetIcon';
import { groupedTargets } from '../extras/featured';

/** Quick search: tap a type → everything of that type in the part of the map you are looking at. */
export default function QuickTab() {
  const { t } = useTranslation();
  const actions = useSearchActions();
  const busy = useSearchUi((s) => s.busy);
  const [filter, setFilter] = useState('');
  const targets = useShownTargets();

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const shown = new Set(targets.map(targetKey));
    return groupedTargets()
      .map(({ group, targets: groupTargets }) => ({
        group,
        items: groupTargets
          .filter((x) => shown.has(targetKey(x)))
          .map((x) => ({ x, label: t(targetLabelKey(x)) }))
          .filter((i) => !q || i.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [filter, t, targets]);
  const pick = (x: MapTarget) => void actions.quick(x);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t('search.quickHint')}</p>
      <SearchInput value={filter} onChange={setFilter} placeholder={t('search.filterTypes')} debounceMs={0} />
      {groups.length === 0 && <p className="text-sm text-muted">{t('common.noData')}</p>}
      <div className="space-y-2">
        {groups.map(({ group, items }) => {
          const Icon = GROUP_ICON[group];
          return (
            <details key={group} open={filter.trim() !== '' || undefined} className="rounded-xl border border-line bg-surface/40">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-fg hover:bg-subtle [&::-webkit-details-marker]:hidden">
                <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span className="flex-1">{t(groupLabelKey(group))}</span>
                <span className="text-xs font-normal text-muted" dir="ltr">{items.length}</span>
              </summary>
              <div className="grid grid-cols-2 gap-2 border-t border-line p-2">
                {items.map(({ x, label }) => (
                  <button
                    key={targetKey(x)}
                    type="button"
                    disabled={busy}
                    onClick={() => pick(x)}
                    className={clsx(
                      'flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-start text-sm font-semibold text-fg',
                      'hover:border-brand hover:bg-brand-light disabled:opacity-60',
                    )}
                  >
                    <span aria-hidden className="shrink-0 text-lg"><TargetIcon target={x} /></span>
                    <span className="min-w-0 flex-1 leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

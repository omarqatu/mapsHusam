import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Briefcase,
  BriefcaseMedical,
  Building2,
  Car,
  Ellipsis,
  Fuel,
  Landmark,
  PartyPopper,
  School,
  Signpost,
  Store,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SearchInput from '@/components/ui/SearchInput';
import { targetIcon, targetKey, targetLabelKey, type MapTarget } from '../targets';
import { groupedTargets, type TypeGroupId } from './featured';
import { matchesQuery } from './status';

const GROUP_ICON: Record<TypeGroupId, LucideIcon> = {
  roads: Signpost,
  fuel: Fuel,
  realestate: Building2,
  technicians: Wrench,
  health: BriefcaseMedical,
  vehicles: Car,
  professional: UserRound,
  events: PartyPopper,
  misc: Ellipsis,
  landmarks: Landmark,
  commercial: Store,
  education: School,
  jobs: Briefcase,
};

const GROUPS = groupedTargets();

function Check({
  checked,
  indeterminate,
  onChange,
  children,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-fg hover:bg-subtle">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand"
      />
      {children}
    </label>
  );
}

interface Props {
  /** Selected type keys (`targetKey`). Empty = every type. */
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}

/** Grouped type checkboxes with a filter box (legacy "filter by service or property type" of the nearby section). */
export default function TypeFilter({ selected, onChange }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const label = (x: MapTarget) => t(targetLabelKey(x));
  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        visible: g.targets.filter((x) => matchesQuery(t(targetLabelKey(x)), query)),
      })).filter((g) => g.visible.length > 0),
    [query, t],
  );

  const toggle = (keys: string[], on: boolean) => {
    const next = new Set(selected);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <SearchInput
        value={query}
        onChange={setQuery}
        debounceMs={0}
        placeholder={t('extras.featured.filterTypes')}
      />
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
        {groups.length === 0 && <p className="p-2 text-sm text-muted">{t('common.noData')}</p>}
        {groups.map(({ group, targets, visible }) => {
          const Icon = GROUP_ICON[group];
          const keys = targets.map(targetKey);
          const count = keys.filter((k) => selected.has(k)).length;
          if (targets.length === 1) {
            const only = targets[0];
            return (
              <Check
                key={group}
                checked={selected.has(targetKey(only))}
                onChange={(v) => toggle([targetKey(only)], v)}
              >
                <Icon className="h-4 w-4 text-muted" aria-hidden /> {label(only)}
              </Check>
            );
          }
          return (
            <details key={group} className="rounded-lg" open={query.trim() !== '' || count > 0 || undefined}>
              <summary className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm font-semibold text-fg hover:bg-subtle">
                <Icon className="h-4 w-4 text-muted" aria-hidden />
                {t(`extras.featured.groups.${group}`)}
                <span className="text-xs font-normal text-muted">({targets.length})</span>
              </summary>
              <div className="ms-3 border-s border-line ps-2">
                <Check
                  checked={count === keys.length}
                  indeterminate={count > 0 && count < keys.length}
                  onChange={(v) => toggle(keys, v)}
                >
                  <span className="font-semibold">{t('extras.featured.selectGroup')}</span>
                </Check>
                {visible.map((x) => (
                  <Check
                    key={targetKey(x)}
                    checked={selected.has(targetKey(x))}
                    onChange={(v) => toggle([targetKey(x)], v)}
                  >
                    <span aria-hidden>{targetIcon(x)}</span> {label(x)}
                  </Check>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

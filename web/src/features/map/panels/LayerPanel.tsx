import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';
import { useAuthStore } from '@/store/authStore';
import { GROUP_ICON } from '@/features/search/categories';
import { BASEMAPS, REAL_ESTATE_LAYERS, SERVICE_TYPES } from '../config';
import { groupedTargets, type TypeGroupId } from '../extras/featured';
import { useMapUi } from '../store';
import MapSheet from './MapSheet';

const ALL_SERVICE_KEYS = SERVICE_TYPES.map((s) => s.key);
// The same groups as the search page (one table, in extras/featured.ts): service types only, real estate has its own section.
const SERVICE_GROUPS = groupedTargets()
  .map((g) => ({ group: g.group, keys: g.targets.flatMap((x) => (x.kind === 'realEstate' ? [] : [x.discriminator])) }))
  .filter((g) => g.keys.length > 0);

function Toggle({
  id,
  label,
  icon,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  icon?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand"
      />
      {icon && (
        <span aria-hidden className="w-6 text-center text-lg">
          {icon}
        </span>
      )}
      <span className="flex-1 text-sm text-slate-700">{label}</span>
    </label>
  );
}

interface GroupItem {
  key: string;
  icon: string;
  label: string;
}

/** One collapsible group of service types with a tri-state "all" box (visible / total). */
function ServiceGroup({ id, items, forceOpen }: { id: TypeGroupId; items: GroupItem[]; forceOpen: boolean }) {
  const { t } = useTranslation();
  const hidden = useMapUi((s) => s.hiddenServices);
  const setServicesVisible = useMapUi((s) => s.setServicesVisible);
  const setServiceVisible = useMapUi((s) => s.setServiceVisible);
  const Icon = GROUP_ICON[id];
  const on = items.filter((i) => !hidden.has(i.key)).length;
  const all = on === items.length;
  return (
    <details open={forceOpen || undefined} className="group rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
        <Icon className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
        <span className="flex-1 text-sm font-bold text-slate-800">{t(`extras.featured.groups.${id}`)}</span>
        <span className="text-xs font-semibold text-slate-600" dir="ltr">
          {on}/{items.length}
        </span>
        <input
          type="checkbox"
          aria-label={t(`extras.featured.groups.${id}`)}
          checked={all}
          ref={(el) => {
            if (el) el.indeterminate = on > 0 && !all;
          }}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setServicesVisible(items.map((i) => i.key), e.target.checked)}
          className="h-4 w-4 accent-[var(--color-brand)]"
        />
      </summary>
      <div className="border-t border-slate-100 px-1 py-1">
        {items.map((s) => (
          <Toggle
            key={s.key}
            id={`svc-${s.key}`}
            icon={s.icon}
            label={s.label}
            checked={!hidden.has(s.key)}
            onChange={(v) => setServiceVisible(s.key, v)}
          />
        ))}
      </div>
    </details>
  );
}

/** Layer & basemap panel (legacy layer-manager.js). Side sheet on desktop, bottom sheet on phones. */
export default function LayerPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const ui = useMapUi();
  const [filter, setFilter] = useState('');

  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  // "No background" is for admins (editing, printing); everyone else has three real maps to choose from.
  const basemaps = BASEMAPS.filter((b) => b !== 'none' || isAdmin || ui.basemap === 'none');

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const byKey = new Map(SERVICE_TYPES.map((s) => [s.key, { ...s, label: t(`services.${s.key}`) }]));
    return SERVICE_GROUPS.map((g) => ({
      group: g.group,
      items: g.keys.flatMap((k) => {
        const s = byKey.get(k);
        return s && (!q || s.label.toLowerCase().includes(q)) ? [s] : [];
      }),
    })).filter((g) => g.items.length > 0);
  }, [filter, t]);

  if (!open) return null;

  return (
    <MapSheet title={t('map.layers')} label={t('map.layers')} side="end" onClose={onClose}>
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-700">{t('map.basemap')}</h3>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('map.basemap')}>
            {basemaps.map((b) => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={ui.basemap === b}
                onClick={() => ui.setBasemap(b)}
                className={clsx(
                  'rounded-lg border px-3 py-2 text-sm font-semibold',
                  ui.basemap === b
                    ? 'border-brand bg-brand-light text-brand'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {t(`basemaps.${b}`)}
              </button>
            ))}
          </div>
        </section>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => ui.setAllVisible(true, ALL_SERVICE_KEYS)}
          >
            {t('map.showAll')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => ui.setAllVisible(false, ALL_SERVICE_KEYS)}
          >
            {t('map.hideAll')}
          </Button>
        </div>

        <section>
          <h3 className="mb-1 text-sm font-bold text-slate-700">{t('map.realEstate')}</h3>
          {REAL_ESTATE_LAYERS.map((l) => (
            <Toggle
              key={l.key}
              id={`layer-${l.key}`}
              icon={l.icon}
              label={t(`layers.${l.key}`)}
              checked={ui.realEstateVisible[l.key]}
              onChange={(v) => ui.setRealEstateVisible(l.key, v)}
            />
          ))}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-700">{t('map.services')}</h3>
          <SearchInput
            value={filter}
            onChange={setFilter}
            placeholder={t('map.filterServices')}
            debounceMs={0}
            className="mb-2"
          />
          <div className="space-y-2">
            {groups.map((g) => (
              <ServiceGroup key={g.group} id={g.group} items={g.items} forceOpen={filter.trim() !== ''} />
            ))}
            {groups.length === 0 && <p className="text-sm text-slate-600">{t('common.noData')}</p>}
          </div>
        </section>
      </div>
    </MapSheet>
  );
}

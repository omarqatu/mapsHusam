import { useMemo, useState } from 'react';
import { ChevronDown, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';
import { useAuthStore } from '@/store/authStore';
import { isLayerShown } from '@/features/visibility/model';
import { useLayerFilter, useVisibility } from '@/features/visibility/store';
import { GROUP_ICON } from '@/features/search/categories';
import { BASEMAPS, REAL_ESTATE_LAYERS, SERVICE_TYPES } from '../config';
import { groupedTargets } from '../extras/featured';
import TargetIcon from '../TargetIcon';
import { groupLabelKey, serviceLabelKey, type TypeGroupId } from '../registry';
import { useMapUi } from '../store';
import { targetFromKey, type MapTarget } from '../targets';
import MapSheet from './MapSheet';

const ALL_SERVICE_KEYS = SERVICE_TYPES.map((s) => s.key);
// The same groups as the search page (one table: the registry): service types only, real estate has its own section.
const SERVICE_GROUPS = groupedTargets()
  .map((g) => ({ group: g.group, keys: g.targets.flatMap((x) => (x.kind === 'realEstate' ? [] : [x.discriminator])) }))
  .filter((g) => g.keys.length > 0);

function Toggle({
  id,
  label,
  target,
  checked,
  onChange,
  publicHidden = false,
}: {
  id: string;
  label: string;
  /** Whose icon (from the icon library) is drawn before the name. */
  target?: MapTarget | null;
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Admins only see this: the type is hidden from the public (admin page "show & hide"). */
  publicHidden?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-subtle"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand"
      />
      {target && <TargetIcon target={target} className="h-5 w-5 shrink-0 text-muted" />}
      <span className="flex-1 text-sm text-fg">{label}</span>
      {publicHidden && (
        <span className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-muted">
          <EyeOff className="h-3 w-3" aria-hidden />
          {t('visibility.hiddenBadge')}
        </span>
      )}
    </label>
  );
}

interface GroupItem {
  key: string;
  label: string;
  publicHidden: boolean;
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
  // Admins only: how many of these the public does not see.
  const publicHidden = items.filter((i) => i.publicHidden).length;
  return (
    <details open={forceOpen || undefined} className="group rounded-xl border border-line bg-surface/60">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
        <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <span className="flex-1 text-sm font-bold text-fg">{t(groupLabelKey(id))}</span>
        {publicHidden > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-muted"
            title={t('visibility.hiddenBadge')}
          >
            <EyeOff className="h-3 w-3" aria-hidden />
            {publicHidden === items.length ? (
              t('visibility.hiddenBadge')
            ) : (
              <span dir="ltr">{publicHidden}</span>
            )}
          </span>
        )}
        <span className="text-xs font-semibold text-muted" dir="ltr">
          {on}/{items.length}
        </span>
        <input
          type="checkbox"
          aria-label={t(groupLabelKey(id))}
          checked={all}
          ref={(el) => {
            if (el) el.indeterminate = on > 0 && !all;
          }}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setServicesVisible(items.map((i) => i.key), e.target.checked)}
          className="h-4 w-4 accent-[var(--color-brand)]"
        />
      </summary>
      <div className="border-t border-line px-1 py-1">
        {items.map((s) => (
          <Toggle
            key={s.key}
            id={`svc-${s.key}`}
            target={targetFromKey(s.key)}
            label={s.label}
            checked={!hidden.has(s.key)}
            onChange={(v) => setServiceVisible(s.key, v)}
            publicHidden={s.publicHidden}
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
  // Types hidden by the admin are not offered to the public at all; admins see them, marked.
  const visibility = useVisibility();
  const shown = useLayerFilter();
  // "No background" is for admins (editing, printing); everyone else has three real maps to choose from.
  const basemaps = BASEMAPS.filter((b) => b !== 'none' || isAdmin || ui.basemap === 'none');

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const byKey = new Map(SERVICE_TYPES.map((s) => [s.key, { ...s, label: t(serviceLabelKey(s.key)) }]));
    return SERVICE_GROUPS.map((g) => ({
      group: g.group,
      items: g.keys.flatMap((k) => {
        const s = byKey.get(k);
        return s && shown(k) && (!q || s.label.toLowerCase().includes(q))
          ? [{ ...s, publicHidden: !isLayerShown(visibility, k) }]
          : [];
      }),
    })).filter((g) => g.items.length > 0);
  }, [filter, t, shown, visibility]);
  const realEstate = REAL_ESTATE_LAYERS.filter((l) => shown(l.key));
  const serviceKeys = ALL_SERVICE_KEYS.filter(shown);

  if (!open) return null;

  return (
    <MapSheet title={t('map.layers')} label={t('map.layers')} side="end" onClose={onClose}>
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-bold text-fg">{t('map.basemap')}</h3>
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
                    ? 'border-brand bg-brand-light text-brand-fg'
                    : 'border-line text-muted hover:bg-subtle',
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
            onClick={() => ui.setAllVisible(true, serviceKeys)}
          >
            {t('map.showAll')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => ui.setAllVisible(false, serviceKeys)}
          >
            {t('map.hideAll')}
          </Button>
        </div>

        {realEstate.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-bold text-fg">{t('map.realEstate')}</h3>
            {realEstate.map((l) => (
              <Toggle
                key={l.key}
                id={`layer-${l.key}`}
                target={{ kind: 'realEstate', layer: l.key }}
                label={t(`layers.${l.key}`)}
                checked={ui.realEstateVisible[l.key]}
                onChange={(v) => ui.setRealEstateVisible(l.key, v)}
                publicHidden={!isLayerShown(visibility, l.key)}
              />
            ))}
          </section>
        )}

        {serviceKeys.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-bold text-fg">{t('map.services')}</h3>
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
              {groups.length === 0 && <p className="text-sm text-muted">{t('common.noData')}</p>}
            </div>
          </section>
        )}
      </div>
    </MapSheet>
  );
}

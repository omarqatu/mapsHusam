import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';
import { BASEMAPS, REAL_ESTATE_LAYERS, SERVICE_TYPES } from '../config';
import { useMapUi } from '../store';
import MapSheet from './MapSheet';

const ALL_SERVICE_KEYS = SERVICE_TYPES.map((s) => s.key);

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

/** Layer & basemap panel (legacy layer-manager.js). Side sheet on desktop, bottom sheet on phones. */
export default function LayerPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const ui = useMapUi();
  const [filter, setFilter] = useState('');

  const services = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = SERVICE_TYPES.map((s) => ({ ...s, label: t(`services.${s.key}`) }));
    return q ? list.filter((s) => s.label.toLowerCase().includes(q)) : list;
  }, [filter, t]);

  if (!open) return null;

  return (
    <MapSheet title={t('map.layers')} label={t('map.layers')} side="end" onClose={onClose}>
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-700">{t('map.basemap')}</h3>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('map.basemap')}>
            {BASEMAPS.map((b) => (
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
          {services.map((s) => (
            <Toggle
              key={s.key}
              id={`svc-${s.key}`}
              icon={s.icon}
              label={s.label}
              checked={!ui.hiddenServices.has(s.key)}
              onChange={(v) => ui.setServiceVisible(s.key, v)}
            />
          ))}
        </section>
      </div>
    </MapSheet>
  );
}

import { useState } from 'react';
import { Crosshair, LocateFixed, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import SelectInput from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import { useOlMap } from '../MapContext';
import { GeoError, locateOnce } from '../geolocate';
import { FUEL_FIELDS, FUEL_OPTIONS, STOP_OPTIONS } from './model';
import { type MapTarget } from '../targets';
import { EMPTY_EXTRA, MAX_RADIUS_M, type NearbyExtra } from './nearby';
import { useSearchUi } from './store';
import { isFuelStation, isRoadBarrier } from '../targets';
import TargetSelect from './TargetSelect';
import { useSearchActions } from './useSearchActions';

/** Search by location: a point (my location or a tap on the map), a radius, a type, and status filters for checkpoints / fuel. */
export default function NearbyTab() {
  const { t } = useTranslation();
  const map = useOlMap();
  const actions = useSearchActions();
  const { busy, picking, nearbyCenter } = useSearchUi();
  const setPicking = useSearchUi((s) => s.setPicking);
  const setNearbyCenter = useSearchUi((s) => s.setNearbyCenter);
  const [target, setTarget] = useState<MapTarget | null>(null);
  const [radius, setRadius] = useState('500');
  const [extra, setExtra] = useState<NearbyExtra>(EMPTY_EXTRA);
  const [locating, setLocating] = useState(false);

  const isBarrier = isRoadBarrier(target);
  const isFuel = isFuelStation(target);

  const useMyLocation = () => {
    setPicking(false);
    setLocating(true);
    locateOnce()
      .then((c) => {
        setNearbyCenter(c);
        map?.getView().animate({ center: c, zoom: 18, duration: 1000 });
      })
      .catch((e: unknown) => toast.error(t(e instanceof GeoError ? e.messageKey : 'map.gps.failed')))
      .finally(() => setLocating(false));
  };

  const run = () => {
    if (!nearbyCenter) return toast.warning(t('search.nearby.pickCenterFirst'));
    if (!target) return toast.warning(t('search.nearby.pickTypeFirst'));
    void actions.nearby(target, nearbyCenter, radius, extra);
  };

  const clear = () => {
    setNearbyCenter(null);
    setPicking(false);
    setRadius('500');
    setExtra(EMPTY_EXTRA);
    setTarget(null);
    actions.clear();
  };

  const status = picking
    ? t('search.nearby.pickHint')
    : locating
      ? t('search.nearby.locating')
      : nearbyCenter
        ? t('search.nearby.centerSet')
        : t('search.nearby.notSet');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={useMyLocation}
          loading={locating}
          startIcon={<LocateFixed className="h-4 w-4" />}
        >
          {t('search.nearby.myLocation')}
        </Button>
        <Button
          variant={picking ? 'primary' : 'secondary'}
          onClick={() => setPicking(!picking)}
          startIcon={<Crosshair className="h-4 w-4" />}
        >
          {t('search.nearby.pickOnMap')}
        </Button>
      </div>
      <p
        role="status"
        className={`flex items-center gap-1.5 text-sm ${nearbyCenter ? 'text-ok' : picking ? 'text-brand-fg' : 'text-muted'}`}
      >
        <MapPin className="h-4 w-4" aria-hidden /> {status}
      </p>

      <FormField label={t('search.type')} name="nearby-type">
        <TargetSelect
          id="nearby-type"
          value={target}
          onChange={(x) => {
            setTarget(x);
            setExtra(EMPTY_EXTRA);
          }}
        />
      </FormField>

      {isBarrier && (
        <FormField label={t('search.nearby.barrierStatus')} name="nearby-stop">
          <SelectInput
            id="nearby-stop"
            value={extra.stop}
            onChange={(e) => setExtra({ ...extra, stop: e.target.value })}
            options={[
              { value: '', label: t('search.nearby.anyStatus') },
              ...STOP_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
            ]}
          />
        </FormField>
      )}
      {isFuel &&
        FUEL_FIELDS.map((f) => (
          <FormField
            key={f}
            label={`${t(`popup.fuel.${f}`)} (${t('search.nearby.optional')})`}
            name={`nearby-${f}`}
          >
            <SelectInput
              id={`nearby-${f}`}
              value={extra.fuel[f]}
              onChange={(e) => setExtra({ ...extra, fuel: { ...extra.fuel, [f]: e.target.value } })}
              options={[
                { value: '', label: t('search.nearby.noCondition') },
                ...FUEL_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
              ]}
            />
          </FormField>
        ))}

      <FormField label={t('search.nearby.radius')} name="nearby-radius">
        <TextInput
          id="nearby-radius"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_RADIUS_M}
          dir="ltr"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
        />
        <p className="text-sm text-muted">{t('search.nearby.radiusHint')}</p>
      </FormField>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={run} loading={busy}>
          {t('search.run')}
        </Button>
        <Button variant="secondary" onClick={clear}>
          {t('search.clear')}
        </Button>
      </div>
    </div>
  );
}

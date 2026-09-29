import { LogIn, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FUEL_FIELDS } from '../config';
import { barrierDirections, fuelAvailable, type Props } from '../popup/featureModel';

const pill = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold';
/** Colour + 8% tint of the same colour behind it (all status colours are 6-digit hex). */
const tone = (color: string) => ({ color, backgroundColor: `${color}15` });

/** Road checkpoint: inbound (`stop`) and outbound (`stop2`) status side by side. */
export function BarrierBadges({ props }: { props: Props }) {
  const { t } = useTranslation();
  const { inbound, outbound } = barrierDirections(props);
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={pill} style={tone(inbound.color)}>
        <LogIn className="h-3 w-3" aria-hidden /> {t('popup.inbound')}: {inbound.icon}{' '}
        {t(`roadStatus.${inbound.key}`)}
      </span>
      <span className={pill} style={tone(outbound?.color ?? '#6c757d')}>
        <LogOut className="h-3 w-3" aria-hidden /> {t('popup.outbound')}: {outbound?.icon ?? '⚪'}{' '}
        {outbound ? t(`roadStatus.${outbound.key}`) : t('popup.notSet')}
      </span>
    </div>
  );
}

/** Fuel station: diesel / 95 / 98, green when available. */
export function FuelBadges({ props }: { props: Props }) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t('popup.fuel.title')}>
      {FUEL_FIELDS.map((f) => {
        const ok = fuelAvailable(props, f);
        return (
          <li key={f} className={pill} style={tone(ok ? '#28a745' : '#dc3545')}>
            <span aria-hidden>{ok ? '✔️' : '❌'}</span>
            {t(`popup.fuel.${f}`)}
            <span className="sr-only">{ok ? t('popup.fuel.available') : t('popup.fuel.unavailable')}</span>
          </li>
        );
      })}
    </ul>
  );
}

import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { AVAILABILITY_TONE, availabilityLabelKey, type Availability } from './featureModel';

/** "Open now" / "Closed now" / "Not available right now" / "Withdrawn" as one coloured word (+ e.g. the hours). */
export function AvailabilityText({ value, suffix, className }: { value: Availability; suffix?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={clsx(className)} style={{ color: AVAILABILITY_TONE[value] }}>
      {t(availabilityLabelKey(value))}
      {suffix ? ` · ${suffix}` : ''}
    </span>
  );
}

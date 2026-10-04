import { useTranslation } from 'react-i18next';
import { formatAgo, relativeUpdate } from './status';

/**
 * "Last update: 5 minutes ago" (legacy `formatRelativeUpdateTime`): "just now" in green under 10 minutes, otherwise rounded
 * to 5 minutes. `now` is the reference time (the data's fetch time, so the text only changes when new data arrives).
 */
export default function UpdatedAgo({
  at,
  now,
  className = 'text-sm text-muted',
}: {
  at: string | null | undefined;
  now: number;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const rel = relativeUpdate(at, now);
  const label =
    rel.kind === 'never'
      ? t('extras.status.never')
      : rel.kind === 'unknown'
        ? t('extras.status.unknown')
        : rel.kind === 'now'
          ? t('extras.status.justNow')
          : formatAgo(rel, i18n.language);
  return (
    <span className={className}>
      {t('extras.status.updated')}{' '}
      <span className={rel.kind === 'now' ? 'font-bold text-ok' : undefined}>{label}</span>
    </span>
  );
}

import { Navigation } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { directionsLink } from '../tools/share';

/**
 * «اتجاهات»: Google Maps directions to the point (on a phone the Maps app, turn by turn). Signed-in users only (owner);
 * `iconOnly` for the compact search-result row.
 */
export default function DirectionsButton({
  coordinate,
  iconOnly = false,
  className,
}: {
  coordinate: readonly number[];
  iconOnly?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const signedIn = useAuthStore((s) => s.user !== null);
  if (!signedIn) return null;
  const label = t('popup.directions');
  return (
    <button
      type="button"
      onClick={() => window.open(directionsLink(coordinate), '_blank', 'noopener,noreferrer')}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={clsx(
        'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface text-sm font-semibold text-fg hover:bg-subtle',
        iconOnly ? 'w-9' : 'px-3',
        className,
      )}
    >
      <Navigation className="h-4 w-4" aria-hidden />
      {!iconOnly && label}
    </button>
  );
}

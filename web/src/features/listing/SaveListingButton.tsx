import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Button from '@/components/ui/Button';
import { targetKey, type MapTarget } from '../map/targets';
import { useIsSaved, useSavedListings } from './savedStore';

/**
 * The heart: keep a listing to come back to (this device, no account). `overlay` = a round button over a card's
 * picture; otherwise a button in a row of actions.
 */
export default function SaveListingButton({
  target,
  id,
  overlay,
}: {
  target: MapTarget;
  id: string;
  overlay?: boolean;
}) {
  const { t } = useTranslation();
  const key = targetKey(target);
  const saved = useIsSaved(key, id);
  const toggle = useSavedListings((s) => s.toggle);
  const icon = <Heart className={clsx('h-4 w-4', saved && 'fill-current text-danger')} aria-hidden />;
  if (overlay)
    return (
      <button
        type="button"
        aria-pressed={saved}
        aria-label={t('listing.save')}
        title={t(saved ? 'listing.saved' : 'listing.save')}
        onClick={() => toggle(key, id)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface/95 text-fg shadow-sm transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-brand"
      >
        {icon}
      </button>
    );
  return (
    <Button variant="secondary" size="sm" startIcon={icon} onClick={() => toggle(key, id)}>
      {t(saved ? 'listing.saved' : 'listing.save')}
    </Button>
  );
}

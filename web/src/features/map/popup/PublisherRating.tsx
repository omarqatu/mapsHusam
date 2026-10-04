import { BadgeCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePublisherRating } from '@/api/mapEvents';
import RatingSummary from '@/components/ui/RatingSummary';

/**
 * The publisher's standing: the average over every rating of all their listings (a landlord with five flats, a
 * provider with two services). Only for a listing with a registered owner, and only once they have more than this one
 * listing or any rating — otherwise it would repeat the listing's own line.
 */
export default function PublisherRating({ layer, featureId }: { layer: string; featureId: string }) {
  const { t } = useTranslation();
  const { data } = usePublisherRating(layer, featureId);
  if (!data?.publisher || (data.listings < 2 && data.totalRatings === 0)) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted">
      <BadgeCheck className="h-4 w-4 text-brand-fg" aria-hidden />
      <span className="font-semibold text-fg">{t('popup.publisher.title')}</span>
      {data.totalRatings > 0 ? (
        <RatingSummary value={data.averageRating} count={data.totalRatings} />
      ) : (
        <span>{t('popup.publisher.noRatings')}</span>
      )}
      <span aria-hidden>·</span>
      <span>{t('popup.publisher.listings', { count: data.listings })}</span>
    </p>
  );
}

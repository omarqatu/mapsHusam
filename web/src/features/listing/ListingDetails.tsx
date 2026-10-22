import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ButtonLink from '@/components/ui/ButtonLink';
import FeaturedCard from '../map/extras/FeaturedCard';
import PropertyRelations from '../property-relations/PropertyRelations';
import PropertyServices from '../property-services/PropertyServices';
import type { FeaturedEntry, FeaturedMode } from '../map/extras/featured';
import { beforeAfterPair, collectMedia, listingTitle } from '../map/popup/featureModel';
import TargetIcon from '@/features/map/TargetIcon';
import type { MapEventSource } from '@/api/mapEvents';
import SaveListingButton from './SaveListingButton';
import ShareListingButton from './ShareListingButton';
import { listingPath, listingUrl } from './link';

interface Props {
  entry: FeaturedEntry;
  mode?: FeaturedMode;
  badge?: string;
  note?: string;
  contactSource?: MapEventSource;
}

/**
 * Everything about one listing: its pictures / video, the description, ratings, contact, "show on the map", sharing,
 * and what is linked to it. The body of the listing preview; its own page (`/l/:key/:id`) is one tap away.
 */
export default function ListingDetails({
  entry,
  mode = 'all',
  badge,
  note,
  contactSource = 'quick_search',
}: Props) {
  const { t } = useTranslation();
  const { r } = entry;
  return (
    <div className="space-y-3">
      {/* No picture of its own: its type's icon as a header, so the listing never opens on bare text. */}
      {collectMedia(r.props).length === 0 && !beforeAfterPair(r.props) && (
        <div
          className="-mx-4 -mt-4 flex h-28 items-center justify-center bg-gradient-to-br from-brand-light to-subtle"
          aria-hidden
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-4xl text-brand-fg shadow-float">
            <TargetIcon target={r.target} />
          </span>
        </div>
      )}
      <FeaturedCard
        entry={entry}
        mode={mode}
        badge={badge}
        note={note}
        bare
        contactSource={contactSource}
        actions={
          r.id !== null && (
            <>
              <SaveListingButton target={r.target} id={r.id} />
              <ShareListingButton
                title={listingTitle(r.target, r.props, t)}
                url={listingUrl(r.target, r.id)}
                tile
              />
            </>
          )
        }
      />
      {r.id !== null && (
        <ButtonLink
          to={listingPath(r.target, r.id)}
          variant="secondary"
          className="w-full"
          startIcon={<ExternalLink className="h-4 w-4" aria-hidden />}
        >
          {t('listing.page.open')}
        </ButtonLink>
      )}
      <PropertyRelations target={r.target} propertyId={r.id} />
      <PropertyServices
        target={r.target}
        propertyId={r.id}
        origin={r.center}
        props={r.props}
        contactSource={contactSource}
      />
    </div>
  );
}

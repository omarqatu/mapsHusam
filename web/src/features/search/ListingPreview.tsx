import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import FeaturedCard from '../map/extras/FeaturedCard';
import PropertyRelations from '../property-relations/PropertyRelations';
import PropertyServices from '../property-services/PropertyServices';
import type { FeaturedEntry, FeaturedMode } from '../map/extras/featured';
import { beforeAfterPair, collectMedia, listingTitle } from '../map/popup/featureModel';
import TargetIcon from '@/features/map/TargetIcon';
import type { MapEventSource } from '@/api/mapEvents';

interface Props {
  entry: FeaturedEntry | null;
  onClose: () => void;
  mode?: FeaturedMode;
  badge?: string;
  note?: string;
  contactSource?: MapEventSource;
}

/**
 * Everything about one listing, opened from its card: every picture / video / link, the description, the real customer
 * ratings with comments, contact with the number shown, and "show on the map". A sheet from the bottom on phones.
 */
export default function ListingPreview({
  entry,
  onClose,
  mode = 'all',
  badge,
  note,
  contactSource = 'quick_search',
}: Props) {
  const { t } = useTranslation();
  return (
    <Modal
      open={entry !== null}
      onClose={onClose}
      title={entry ? listingTitle(entry.r.target, entry.r.props, t) : ''}
      widthClass="sm:max-w-xl"
      sheetOnPhone
    >
      {entry && (
        <div className="space-y-3">
          {/* No picture of its own: its type's icon as a header, so the preview never opens on bare text. */}
          {collectMedia(entry.r.props).length === 0 && !beforeAfterPair(entry.r.props) && (
            <div
              className="-mx-4 -mt-4 flex h-28 items-center justify-center bg-gradient-to-br from-brand-light to-subtle"
              aria-hidden
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-4xl text-brand-fg shadow-float">
                <TargetIcon target={entry.r.target} />
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
          />
          <PropertyRelations target={entry.r.target} propertyId={entry.r.id} />
          <PropertyServices
            target={entry.r.target}
            propertyId={entry.r.id}
            origin={entry.r.center}
            props={entry.r.props}
            contactSource={contactSource}
          />
        </div>
      )}
    </Modal>
  );
}

import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import type { FeaturedEntry, FeaturedMode } from '../map/extras/featured';
import { listingTitle } from '../map/popup/featureModel';
import type { MapEventSource } from '@/api/mapEvents';
import ListingDetails from '../listing/ListingDetails';

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
export default function ListingPreview({ entry, onClose, mode = 'all', badge, note, contactSource }: Props) {
  const { t } = useTranslation();
  return (
    <Modal
      open={entry !== null}
      onClose={onClose}
      title={entry ? listingTitle(entry.r.target, entry.r.props, t) : ''}
      widthClass="sm:max-w-xl"
      sheetOnPhone
    >
      {entry && <ListingDetails entry={entry} mode={mode} badge={badge} note={note} contactSource={contactSource} />}
    </Modal>
  );
}

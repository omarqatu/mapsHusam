import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import FeaturedCard from '../map/extras/FeaturedCard';
import PropertyRelations from '../property-relations/PropertyRelations';
import PropertyServices from '../property-services/PropertyServices';
import type { FeaturedEntry, FeaturedMode } from '../map/extras/featured';
import { groupOf } from '../map/extras/featured';
import { beforeAfterPair, collectMedia, text } from '../map/popup/featureModel';
import { targetLabelKey } from '../map/targets';
import { GROUP_ART } from './art';
import TargetIcon from '@/features/map/TargetIcon';

interface Props {
  entry: FeaturedEntry | null;
  onClose: () => void;
  mode?: FeaturedMode;
  badge?: string;
  note?: string;
}

/**
 * Everything about one listing, opened from its card: every picture / video / link, the description, the real customer
 * ratings with comments, contact with the number shown, and "show on the map". A sheet from the bottom on phones.
 */
export default function ListingPreview({ entry, onClose, mode = 'all', badge, note }: Props) {
  const { t } = useTranslation();
  return (
    <Modal
      open={entry !== null}
      onClose={onClose}
      title={entry ? text(entry.r.props.name) || text(entry.r.props.location_name) || t(targetLabelKey(entry.r.target)) : ''}
      widthClass="sm:max-w-xl"
      sheetOnPhone
    >
      {entry && (
        <div className="space-y-3">
          {/* No picture of its own: its section's illustration as a header, so the preview never opens on bare text. */}
          {collectMedia(entry.r.props).length === 0 && !beforeAfterPair(entry.r.props) && GROUP_ART[groupOf(entry.r.target)] && (
            <div className="relative -mx-4 -mt-4 h-36 overflow-hidden bg-brand-light" aria-hidden>
              <img src={GROUP_ART[groupOf(entry.r.target)]} alt="" className="h-full w-full object-cover object-left-bottom opacity-70 saturate-50" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-4xl shadow-float"><TargetIcon target={entry.r.target} /></span>
              </span>
            </div>
          )}
          <FeaturedCard entry={entry} mode={mode} badge={badge} note={note} bare />
          <PropertyRelations target={entry.r.target} propertyId={entry.r.id} />
          <PropertyServices target={entry.r.target} propertyId={entry.r.id} origin={entry.r.center} props={entry.r.props} />
        </div>
      )}
    </Modal>
  );
}

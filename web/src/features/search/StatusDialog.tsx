import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import type { StatusLayer } from '@/api/liveStatus';
import StatusTab from '../map/extras/StatusTab';

/** Live road-checkpoint / fuel-station status list (legacy: the widgets portal opened at that card). */
export default function StatusDialog({ layer, onClose }: { layer: StatusLayer | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal
      open={layer !== null}
      onClose={onClose}
      title={t(layer === 'fuel_stations' ? 'searchPage.fuelStatus' : 'searchPage.roadStatus')}
      widthClass="max-w-2xl"
    >
      {layer && <StatusTab layer={layer} />}
    </Modal>
  );
}

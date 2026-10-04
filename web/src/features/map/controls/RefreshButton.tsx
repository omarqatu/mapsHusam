import { RefreshCw } from 'lucide-react';
import type VectorLayer from 'ol/layer/Vector';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui/toastStore';
import { useOlMap } from '../MapContext';
import MapButton from './MapButton';

/** Reload the data layers now (they also refresh by themselves every minute). */
export default function RefreshButton() {
  const { t } = useTranslation();
  const map = useOlMap();
  const refresh = () => {
    (map?.get('dataLayers') as VectorLayer[] | undefined)?.forEach((l) => l.getSource()?.refresh());
    toast.success(t('map.refreshed'));
  };
  return (
    <MapButton label={t('map.refresh')} onClick={refresh}>
      <RefreshCw className="h-5 w-5" />
    </MapButton>
  );
}

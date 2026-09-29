import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOlMap } from '../MapContext';
import MapButton from './MapButton';

export default function ZoomButtons() {
  const { t } = useTranslation();
  const map = useOlMap();
  const zoomBy = (delta: number) => {
    const view = map?.getView();
    const z = view?.getZoom();
    if (view && z !== undefined) view.animate({ zoom: z + delta, duration: 200 });
  };
  return (
    <div className="flex flex-col gap-2">
      <MapButton label={t('map.zoomIn')} onClick={() => zoomBy(1)}>
        <Plus className="h-5 w-5" />
      </MapButton>
      <MapButton label={t('map.zoomOut')} onClick={() => zoomBy(-1)}>
        <Minus className="h-5 w-5" />
      </MapButton>
    </div>
  );
}

import { Ruler, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MapButton from '../controls/MapButton';
import { useMapUi, type MapTool } from '../store';

/** The measure and share buttons of the map's tool column. */
export default function ToolButtons() {
  const { t } = useTranslation();
  const active = useMapUi((s) => s.activeTool);
  const setActiveTool = useMapUi((s) => s.setActiveTool);
  const toggle = (tool: MapTool) => setActiveTool(active === tool ? null : tool);

  return (
    <>
      <MapButton label={t('tools.buttonMeasure')} active={active === 'measure'} onClick={() => toggle('measure')}>
        <Ruler className="h-5 w-5" />
      </MapButton>
      <MapButton label={t('tools.buttonShare')} active={active === 'share'} onClick={() => toggle('share')}>
        <Share2 className="h-5 w-5" />
      </MapButton>
    </>
  );
}

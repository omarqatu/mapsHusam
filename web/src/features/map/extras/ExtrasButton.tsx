import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MapButton from '../controls/MapButton';
import { useSearchUi } from '../search/store';
import { useMapUi } from '../store';
import { useExtrasUi } from './store';
import { useShownExtrasTabs } from './useShownTabs';

/** The one map button for featured services, road / fuel status and platform statistics (legacy: 4 coloured buttons). */
export default function ExtrasButton() {
  const { t } = useTranslation();
  const open = useExtrasUi((s) => s.open);
  const nothingToShow = useShownExtrasTabs().length === 0;

  const toggle = () => {
    if (open) return useExtrasUi.getState().closePanel();
    // Same edge as the layer and search panels: make room.
    useMapUi.getState().setLayersOpen(false);
    useSearchUi.getState().closePanel();
    useExtrasUi.getState().openPanel();
  };

  if (nothingToShow) return null;
  return (
    <MapButton label={t('extras.title')} active={open} onClick={toggle}>
      <Sparkles className="h-5 w-5" />
    </MapButton>
  );
}

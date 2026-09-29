import { Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MapButton from '../controls/MapButton';
import { openProviderPanel } from './openPanel';
import { useIsProvider } from './queries';
import { useProviderUi } from './store';

/** Map button of the provider panel; rendered for provider accounts only. */
export default function ProviderButton() {
  const { t } = useTranslation();
  const isProvider = useIsProvider();
  const open = useProviderUi((s) => s.open);
  if (!isProvider) return null;

  const toggle = () => {
    if (open) return useProviderUi.getState().closePanel();
    openProviderPanel();
  };
  return (
    <MapButton label={t('provider.title')} active={open} onClick={toggle}>
      <Wrench className="h-5 w-5" />
    </MapButton>
  );
}

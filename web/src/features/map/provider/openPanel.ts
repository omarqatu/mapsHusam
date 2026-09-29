import { useSearchUi } from '../search/store';
import { useMapUi } from '../store';
import { useProviderUi } from './store';

/**
 * Opens the provider panel and closes the map panels that share its space. The panel state is a store, so it can be
 * called before the map is on screen (the home page does, then navigates to the map).
 */
export function openProviderPanel() {
  useMapUi.getState().setLayersOpen(false);
  useSearchUi.getState().closePanel();
  useProviderUi.getState().openPanel();
}

import { useEffect } from 'react';
import { Layers, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AppHeader from '@/components/AppHeader';
import Toaster from '@/components/ui/Toaster';
import CoordinatesBar from './controls/CoordinatesBar';
import QuickChips from './controls/QuickChips';
import LocateButton from './controls/LocateButton';
import MapButton from './controls/MapButton';
import StatsPill from './controls/StatsPill';
import RefreshButton from './controls/RefreshButton';
import ZoomButtons from './controls/ZoomButtons';
import ExtrasButton from './extras/ExtrasButton';
import ExtrasPanel from './extras/ExtrasPanel';
import MapView from './MapView';
import ProviderButton from './provider/ProviderButton';
import ProviderPanel from './provider/ProviderPanel';
import ProviderTracker from './provider/ProviderTracker';
import FeatureCard from './popup/FeatureCard';
import SelectionController from './popup/SelectionController';
import GlobalSearchBox from './search/GlobalSearchBox';
import ReplayShared from './search/ReplayShared';
import ResultsLayer from './search/ResultsLayer';
import ResultsPanel from './search/ResultsPanel';
import SearchPanel from './search/SearchPanel';
import { useSearchUi } from './search/store';
import { useIsProvider } from './provider/queries';
import { useMapUi } from './store';
import MapTools from './tools/MapTools';
import ToolButtons from './tools/ToolButtons';
import LayerPanel from './panels/LayerPanel';
import TickerBar from '../widgets/components/TickerBar';

/** `/` — the map. Full-screen: a slim brand bar and the map; every tool floats on the map's end edge. */
export default function MapPage() {
  const { t } = useTranslation();
  const layersOpen = useMapUi((s) => s.layersOpen);
  const setLayersOpen = useMapUi((s) => s.setLayersOpen);
  const selected = useMapUi((s) => s.selected);
  const setSelected = useMapUi((s) => s.setSelected);
  const searchOpen = useSearchUi((s) => s.panelOpen);
  const results = useSearchUi((s) => s.results);
  const isProvider = useIsProvider();

  // Phones show one bottom sheet at a time: a tapped marker or a new result list makes room for itself.
  useEffect(() => {
    const makeRoom = () => {
      if (window.innerWidth >= 640) return;
      useMapUi.getState().setLayersOpen(false);
      useSearchUi.getState().closePanel();
    };
    const offMap = useMapUi.subscribe((s, prev) => s.selected && s.selected !== prev.selected && makeRoom());
    const offSearch = useSearchUi.subscribe(
      (s, prev) => s.results && s.results.version !== prev.results?.version && makeRoom(),
    );
    return () => {
      offMap();
      offSearch();
    };
  }, []);

  // Escape closes the top-most sheet only: details card, then the result list. One handler, so the order is fixed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (useMapUi.getState().selected) useMapUi.getState().setSelected(null);
      else if (useSearchUi.getState().results) useSearchUi.getState().setResults(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleLayers = () => {
    if (!layersOpen) useSearchUi.getState().closePanel();
    setLayersOpen(!layersOpen);
  };
  const toggleSearch = () => {
    if (searchOpen) useSearchUi.getState().closePanel();
    else {
      setLayersOpen(false);
      useSearchUi.getState().openPanel();
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col">
      <AppHeader />

      <div className="relative flex-1 overflow-hidden">
        <MapView>
          <SelectionController />
          {isProvider && <ProviderTracker />}
          <ResultsLayer />
          <ReplayShared />
          {/* Short screens (landscape phones): the column scrolls, and refresh/zoom — which have gestures and a
              one-minute auto refresh — step aside so the primary tools stay reachable. */}
          <div className="absolute end-3 top-[6.75rem] z-10 flex max-h-[calc(100%-7.5rem)] flex-col gap-2 overflow-y-auto sm:top-3 sm:max-h-[calc(100%-1.5rem)]">
            <MapButton label={t('search.title')} active={searchOpen} onClick={toggleSearch}>
              <Search className="h-5 w-5" />
            </MapButton>
            <MapButton label={t('map.layers')} active={layersOpen} onClick={toggleLayers}>
              <Layers className="h-5 w-5" />
            </MapButton>
            <ExtrasButton />
            <ProviderButton />
            <ToolButtons />
            <LocateButton />
            <div className="flex flex-col gap-2 [@media(max-height:560px)]:hidden">
              <RefreshButton />
              {/* Phones zoom by pinch / double-tap; the two buttons only cost screen height there. */}
              <div className="flex flex-col gap-2 max-sm:hidden">
                <ZoomButtons />
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-2">
            <CoordinatesBar />
            <StatsPill />
          </div>
          {/* Centred over the map: a full-width bar on phones (tools sit below it), a 28rem pill on desktop. */}
          <div className="absolute inset-x-3 top-3 z-20 sm:mx-auto sm:max-w-md">
            <GlobalSearchBox />
          </div>
          {/* Below the search box, wide enough for all four (the box itself is 28 rem). Under its suggestion list. */}
          <div className="absolute inset-x-3 top-[4.25rem] z-10 sm:mx-auto sm:max-w-xl">
            <QuickChips />
          </div>
          <SearchPanel />
          <MapTools />
          <LayerPanel open={layersOpen} onClose={() => setLayersOpen(false)} />
          <ExtrasPanel />
          <ProviderPanel />
          <ResultsPanel className={selected ? 'max-sm:hidden' : undefined} />
          {results && selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute bottom-3 start-3 z-20 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg sm:hidden"
            >
              {t('search.results.back', { count: results.items.length })}
            </button>
          )}
          {selected && (
            <FeatureCard
              key={`${selected.id}-${selected.coordinate.join()}`}
              feature={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </MapView>
      </div>
      {/* Legacy footer bar. A row of the page (not an overlay), so the map — and every button, sheet, the coordinates and the
          stats pill on it — simply ends above it. One slim line; hidden on landscape phones. */}
      <TickerBar />
      <Toaster />
    </div>
  );
}

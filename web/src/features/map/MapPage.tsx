import { useEffect } from 'react';
import { Layers, ListFilter, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import UserMenu from '@/components/UserMenu';
import Toaster from '@/components/ui/Toaster';
import CoordinatesBar from './controls/CoordinatesBar';
import LocateButton from './controls/LocateButton';
import MapButton from './controls/MapButton';
import RefreshButton from './controls/RefreshButton';
import ZoomButtons from './controls/ZoomButtons';
import MapView from './MapView';
import FeatureCard from './popup/FeatureCard';
import SelectionController from './popup/SelectionController';
import GlobalSearchBox from './search/GlobalSearchBox';
import ReplayShared from './search/ReplayShared';
import ResultsLayer from './search/ResultsLayer';
import ResultsPanel from './search/ResultsPanel';
import SearchPanel from './search/SearchPanel';
import { useSearchUi } from './search/store';
import { useMapUi } from './store';
import LayerPanel from './panels/LayerPanel';

/** `/` — the map. Full-screen: a slim brand bar and the map; every tool floats on the map's end edge. */
export default function MapPage() {
  const { t } = useTranslation();
  const layersOpen = useMapUi((s) => s.layersOpen);
  const setLayersOpen = useMapUi((s) => s.setLayersOpen);
  const selected = useMapUi((s) => s.selected);
  const setSelected = useMapUi((s) => s.setSelected);
  const searchOpen = useSearchUi((s) => s.panelOpen);
  const results = useSearchUi((s) => s.results);

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
      <header className="z-30 flex h-14 shrink-0 items-center gap-3 bg-gradient-to-l from-brand to-brand-2 px-3 text-white shadow">
        <h1 className="truncate text-base font-black sm:text-lg">{t('app.name')}</h1>
        <div className="flex-1" />
        <Link
          to="/search"
          className="hidden items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25 sm:inline-flex"
        >
          <ListFilter className="h-4 w-4" aria-hidden />
          {t('map.searchWithoutMap')}
        </Link>
        <LanguageSwitcher tone="onBrand" />
        <UserMenu tone="onBrand" />
      </header>

      <div className="relative flex-1 overflow-hidden">
        <MapView>
          <SelectionController />
          <ResultsLayer />
          <ReplayShared />
          <div className="absolute end-3 top-3 z-10 flex flex-col gap-2">
            <MapButton label={t('search.title')} active={searchOpen} onClick={toggleSearch}>
              <Search className="h-5 w-5" />
            </MapButton>
            <MapButton label={t('map.layers')} active={layersOpen} onClick={toggleLayers}>
              <Layers className="h-5 w-5" />
            </MapButton>
            <LocateButton />
            <RefreshButton />
            <ZoomButtons />
          </div>
          <div className="absolute bottom-2 start-3 z-10">
            <CoordinatesBar />
          </div>
          <div className="absolute end-16 start-3 top-3 z-20 sm:end-auto sm:w-96">
            <GlobalSearchBox />
          </div>
          <SearchPanel />
          <LayerPanel open={layersOpen} onClose={() => setLayersOpen(false)} />
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
      <Toaster />
    </div>
  );
}

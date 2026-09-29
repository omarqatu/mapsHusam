import { useState } from 'react';
import { Layers, ListFilter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import UserMenu from '@/components/UserMenu';
import Toaster from '@/components/ui/Toaster';
import CoordinatesBar from './controls/CoordinatesBar';
import LocateButton from './controls/LocateButton';
import MapButton from './controls/MapButton';
import ZoomButtons from './controls/ZoomButtons';
import MapView from './MapView';
import FeatureCard from './popup/FeatureCard';
import SelectionController from './popup/SelectionController';
import { useMapUi } from './store';
import LayerPanel from './panels/LayerPanel';

/** `/` — the map. Full-screen: a slim brand bar and the map; every tool floats on the map's end edge. */
export default function MapPage() {
  const { t } = useTranslation();
  const [layersOpen, setLayersOpen] = useState(false);
  const selected = useMapUi((s) => s.selected);
  const setSelected = useMapUi((s) => s.setSelected);

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
          <div className="absolute end-3 top-3 z-10 flex flex-col gap-2">
            <MapButton label={t('map.layers')} active={layersOpen} onClick={() => setLayersOpen((o) => !o)}>
              <Layers className="h-5 w-5" />
            </MapButton>
            <LocateButton />
            <ZoomButtons />
          </div>
          <div className="absolute bottom-2 start-3 z-10">
            <CoordinatesBar />
          </div>
          <LayerPanel open={layersOpen} onClose={() => setLayersOpen(false)} />
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

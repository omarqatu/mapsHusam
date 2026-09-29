import { create } from 'zustand';
import { DEFAULT_BASEMAP, type BasemapKey, type RealEstateLayerKey } from './config';
import type { SelectedFeature } from './popup/featureModel';

// Map UI state only (what is switched on). Features/data never live here.
interface MapUiState {
  basemap: BasemapKey;
  realEstateVisible: Record<RealEstateLayerKey, boolean>;
  /** Service types switched off by the user. */
  hiddenServices: ReadonlySet<string>;
  /** The feature whose details card is open. */
  selected: SelectedFeature | null;
  setSelected: (f: SelectedFeature | null) => void;
  setBasemap: (b: BasemapKey) => void;
  setRealEstateVisible: (key: RealEstateLayerKey, visible: boolean) => void;
  setServiceVisible: (discriminator: string, visible: boolean) => void;
  /** "Show all" / "Hide all" of the layer panel. */
  setAllVisible: (visible: boolean, allServiceKeys: string[]) => void;
}

export const useMapUi = create<MapUiState>((set) => ({
  basemap: DEFAULT_BASEMAP,
  realEstateVisible: { rent: true, sale: true, land: true },
  hiddenServices: new Set(),
  selected: null,
  setSelected: (selected) => set({ selected }),
  setBasemap: (basemap) => set({ basemap }),
  setRealEstateVisible: (key, visible) =>
    set((s) => ({ realEstateVisible: { ...s.realEstateVisible, [key]: visible } })),
  setServiceVisible: (discriminator, visible) =>
    set((s) => {
      const next = new Set(s.hiddenServices);
      if (visible) next.delete(discriminator);
      else next.add(discriminator);
      return { hiddenServices: next };
    }),
  setAllVisible: (visible, allServiceKeys) =>
    set({
      realEstateVisible: { rent: visible, sale: visible, land: visible },
      hiddenServices: visible ? new Set() : new Set(allServiceKeys),
    }),
}));

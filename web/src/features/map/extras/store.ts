import { create } from 'zustand';

export type ExtrasTab = 'featured' | 'roads' | 'fuel' | 'stats';
export const EXTRAS_TABS: ExtrasTab[] = ['featured', 'roads', 'fuel', 'stats'];

// UI state of the "featured & live info" panel only. Server data lives in TanStack Query.
interface ExtrasUiState {
  open: boolean;
  tab: ExtrasTab;
  /** Opens the panel, optionally on a given tab (e.g. from a link to "road status"). */
  openPanel: (tab?: ExtrasTab) => void;
  closePanel: () => void;
  setTab: (t: ExtrasTab) => void;
}

export const useExtrasUi = create<ExtrasUiState>((set) => ({
  open: false,
  tab: 'featured',
  openPanel: (tab) => set((s) => ({ open: true, tab: tab ?? s.tab })),
  closePanel: () => set({ open: false }),
  setTab: (tab) => set({ tab }),
}));

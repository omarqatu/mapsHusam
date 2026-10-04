import { create } from 'zustand';
import type { Coordinate } from '../config';
import type { SearchResult } from './results';
import type { ShareState } from './shareLink';

export type SearchTab = 'quick' | 'smart' | 'nearby';

/** What the map shows for the current search (results list + highlight + centre/radius of a nearby search). */
export interface ResultsState {
  title: string;
  items: SearchResult[];
  /** Replayable description of this search ("copy results link"). */
  share: ShareState | null;
  nearby: { center: Coordinate; radius: number | null } | null;
  /** Bumps on every new result set so the map re-fits even when the items look the same. */
  version: number;
  /** Closest zoom when fitting the results (legacy: 19, nearby 18). */
  fitMaxZoom: number;
}

interface SearchUiState {
  panelOpen: boolean;
  tab: SearchTab;
  busy: boolean;
  results: ResultsState | null;
  /** Nearby search: the point is chosen by tapping the map. */
  picking: boolean;
  /** Nearby search centre (own location or picked point) — kept apart from results so it can be set before searching. */
  nearbyCenter: Coordinate | null;
  openPanel: (tab?: SearchTab) => void;
  closePanel: () => void;
  setTab: (t: SearchTab) => void;
  setBusy: (b: boolean) => void;
  setResults: (r: Omit<ResultsState, 'version'> | null) => void;
  setPicking: (p: boolean) => void;
  setNearbyCenter: (c: Coordinate | null) => void;
}

let version = 0;

export const useSearchUi = create<SearchUiState>((set) => ({
  panelOpen: false,
  tab: 'quick',
  busy: false,
  results: null,
  picking: false,
  nearbyCenter: null,
  openPanel: (tab) => set((s) => ({ panelOpen: true, tab: tab ?? s.tab })),
  closePanel: () => set({ panelOpen: false, picking: false }),
  setTab: (tab) => set({ tab }),
  setBusy: (busy) => set({ busy }),
  setResults: (r) => set({ results: r ? { ...r, version: ++version } : null }),
  setPicking: (picking) => set({ picking }),
  setNearbyCenter: (nearbyCenter) => set({ nearbyCenter }),
}));

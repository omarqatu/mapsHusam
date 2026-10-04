import { create } from 'zustand';

// UI state of the provider panel only. The account / feature data lives in TanStack Query.
interface ProviderUiState {
  open: boolean;
  /** Live tracking is on: the phone's position is sent every 10 s. Kept here so it survives closing the panel. */
  live: boolean;
  /** `Date.now()` until which the status buttons stay locked after a successful update; 0 = not locked. */
  cooldownUntil: number;
  /** Last failed update, already translated / from the server; shown in the panel. */
  error: string | null;
  setError: (e: string | null) => void;
  openPanel: () => void;
  closePanel: () => void;
  setLive: (live: boolean) => void;
  startCooldown: (until: number) => void;
}

export const useProviderUi = create<ProviderUiState>((set) => ({
  open: false,
  live: false,
  cooldownUntil: 0,
  error: null,
  setError: (error) => set({ error }),
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false }),
  setLive: (live) => set({ live }),
  startCooldown: (cooldownUntil) => set({ cooldownUntil }),
}));

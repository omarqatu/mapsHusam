import { create } from 'zustand';

/** Why the visitor is asked to sign in: the sheet's title and text follow it. */
export type LoginReason = 'contact' | 'request';

interface LoginPromptState {
  reason: LoginReason | null;
  open: (reason: LoginReason) => void;
  close: () => void;
}

/** The one "sign in to …" sheet (LoginPrompt, mounted once under the router); any button can open it. */
export const useLoginPrompt = create<LoginPromptState>((set) => ({
  reason: null,
  open: (reason) => set({ reason }),
  close: () => set({ reason: null }),
}));

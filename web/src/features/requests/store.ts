import { create } from 'zustand';

/** What to request: the clicked feature's provider link (the server finds the provider account from it). */
export interface RequestTarget {
  serviceLayer: string;
  featureId: string;
  providerName: string;
  serviceType: string;
}

/** Which request-related dialogs are open. Server data (requests, messages) stays in TanStack Query. */
interface RequestsUi {
  listOpen: boolean;
  chatId: number | null;
  /** Rating (stars + optional comment) for a completed request. */
  ratingFor: { requestId: number; providerName: string; serviceType: string } | null;
  /** Comment for a rating given without one. */
  commentFor: { ratingId: number; providerName: string; serviceType: string } | null;
  /** The "send a service request?" flow. */
  requestFor: RequestTarget | null;
  openList: () => void;
  closeList: () => void;
  openChat: (id: number) => void;
  closeChat: () => void;
  openRating: (v: NonNullable<RequestsUi['ratingFor']>) => void;
  closeRating: () => void;
  openComment: (v: NonNullable<RequestsUi['commentFor']>) => void;
  closeComment: () => void;
  startRequest: (t: RequestTarget) => void;
  endRequest: () => void;
}

export const useRequestsUi = create<RequestsUi>((set) => ({
  listOpen: false,
  chatId: null,
  ratingFor: null,
  commentFor: null,
  requestFor: null,
  openList: () => set({ listOpen: true }),
  closeList: () => set({ listOpen: false }),
  openChat: (chatId) => set({ chatId, listOpen: false }),
  closeChat: () => set({ chatId: null }),
  openRating: (ratingFor) => set((s) => (s.ratingFor ? s : { ratingFor })),
  closeRating: () => set({ ratingFor: null }),
  openComment: (commentFor) => set((s) => (s.commentFor ? s : { commentFor })),
  closeComment: () => set({ commentFor: null }),
  startRequest: (requestFor) => set((s) => (s.requestFor ? s : { requestFor })),
  endRequest: () => set({ requestFor: null }),
}));

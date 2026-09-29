import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (type: ToastType, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (type, message) => {
    const id = nextId++;
    set((s) => ({ items: [...s.items, { id, type, message }] }));
    setTimeout(() => get().dismiss(id), type === 'error' ? 8000 : 4000);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

/** Imperative helper usable outside components (e.g. from query callbacks). Pass translated text. */
export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
  warning: (m: string) => useToastStore.getState().push('warning', m),
};

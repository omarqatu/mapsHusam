import { create } from 'zustand';

/** Listings the viewer saved with the heart: kept on this device only (no account needed), newest first. */
export interface SavedListing {
  /** `targetKey` of its type (rent | sale | land | a service type). */
  key: string;
  id: string;
  savedAt: number;
}

const STORAGE_KEY = 'psm-saved-listings';
export const SAVED_MAX = 100;

const valid = (x: unknown): x is SavedListing =>
  !!x &&
  typeof (x as SavedListing).key === 'string' &&
  typeof (x as SavedListing).id === 'string' &&
  typeof (x as SavedListing).savedAt === 'number';

function read(): SavedListing[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(valid).slice(0, SAVED_MAX) : [];
  } catch {
    return [];
  }
}

function write(items: SavedListing[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage blocked: the list lasts for this visit only */
  }
}

const same = (a: { key: string; id: string }, b: { key: string; id: string }) =>
  a.key === b.key && a.id === b.id;

interface SavedState {
  items: SavedListing[];
  toggle: (key: string, id: string) => void;
  /** Drop listings that no longer exist or are no longer shown (withdrawn, expired, type hidden). */
  forget: (gone: { key: string; id: string }[]) => void;
}

export const useSavedListings = create<SavedState>((set, get) => ({
  items: read(),
  toggle: (key, id) => {
    const { items } = get();
    const next = items.some((i) => same(i, { key, id }))
      ? items.filter((i) => !same(i, { key, id }))
      : [{ key, id, savedAt: Date.now() }, ...items].slice(0, SAVED_MAX);
    write(next);
    set({ items: next });
  },
  forget: (gone) => {
    const next = get().items.filter((i) => !gone.some((g) => same(g, i)));
    if (next.length === get().items.length) return;
    write(next);
    set({ items: next });
  },
}));

export const useIsSaved = (key: string, id: string | null) =>
  useSavedListings((s) => id !== null && s.items.some((i) => i.key === key && i.id === id));

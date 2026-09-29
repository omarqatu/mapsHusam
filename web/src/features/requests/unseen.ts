import { create } from 'zustand';

// "New activity" marks: a request whose message / status change the user has not looked at yet.
// Kept per user in localStorage so a reload does not lose them (legacy kept the same idea in
// `svc_unseen_activity_<uid>*` keys — one JSON list now).

const key = (uid: number) => `svc_unseen_${uid}`;

function read(uid: number): number[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key(uid)) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}
function write(uid: number, ids: number[]) {
  try {
    if (ids.length) localStorage.setItem(key(uid), JSON.stringify(ids));
    else localStorage.removeItem(key(uid));
  } catch {
    /* storage blocked: marks live for this session only */
  }
}

interface UnseenState {
  uid: number | null;
  ids: number[];
  /** Load the marks of the signed-in user (null = signed out). */
  hydrate: (uid: number | null) => void;
  add: (id: number) => void;
  /** One request, or all when no id is given. */
  clear: (id?: number) => void;
}

export const useUnseen = create<UnseenState>((set, get) => ({
  uid: null,
  ids: [],
  hydrate: (uid) => set({ uid, ids: uid ? read(uid) : [] }),
  add: (id) => {
    const { uid, ids } = get();
    if (!uid || ids.includes(id)) return;
    const next = [...ids, id];
    write(uid, next);
    set({ ids: next });
  },
  clear: (id) => {
    const { uid, ids } = get();
    if (!uid) return;
    const next = id === undefined ? [] : ids.filter((x) => x !== id);
    write(uid, next);
    set({ ids: next });
  },
}));

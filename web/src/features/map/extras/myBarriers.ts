import { create } from 'zustand';
import { barrierDirections, type Props } from '../popup/featureModel';

/** «حواجزي»: the checkpoints this device starred (their ids), shown first and watched for changes while the app is open. */
const STORAGE_KEY = 'psm-my-barriers';
const MAX = 30;

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

interface MyBarriers {
  ids: string[];
  toggle: (id: string) => void;
}

export const useMyBarriers = create<MyBarriers>((set, get) => ({
  ids: read(),
  toggle: (id) => {
    const { ids } = get();
    const next = ids.includes(id) ? ids.filter((i) => i !== id) : [id, ...ids].slice(0, MAX);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: the stars last for this visit only */
    }
    set({ ids: next });
  },
}));

/** Both directions' state as one comparable value ("open|closed"): a change in either one is news. */
export const barrierState = (props: Props) => {
  const { inbound, outbound } = barrierDirections(props);
  return `${inbound.key}|${outbound?.key ?? ''}`;
};

/** Starred checkpoints whose state is not the one seen last time (none on the first read: that is the baseline). */
export function changedBarriers(
  before: Map<string, string> | null,
  now: Map<string, string>,
  starred: string[],
) {
  if (!before) return [];
  return starred.filter((id) => before.has(id) && now.has(id) && before.get(id) !== now.get(id));
}

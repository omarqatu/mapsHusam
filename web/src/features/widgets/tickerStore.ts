import { create } from 'zustand';

const KEY = 'psm-ticker-hidden';

function read() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

interface TickerUi {
  /** The floating bar on the map is folded into a small chip; remembered between visits. */
  hidden: boolean;
  setHidden: (v: boolean) => void;
}

export const useTickerUi = create<TickerUi>((set) => ({
  hidden: read(),
  setHidden: (hidden) => {
    try {
      localStorage.setItem(KEY, hidden ? '1' : '0');
    } catch {
      /* storage blocked: the choice lasts for this visit only */
    }
    set({ hidden });
  },
}));

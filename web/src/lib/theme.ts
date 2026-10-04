export type ThemeChoice = 'light' | 'dark';

const KEY = 'psm-theme';

/** The theme in effect: an explicit choice on <html>, else the system setting. */
export function currentTheme(): ThemeChoice {
  const set = document.documentElement.getAttribute('data-theme');
  if (set === 'dark' || set === 'light') return set;
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

/** Saves the choice and applies it at once (public/theme-init.js applies it before first paint on the next visit). */
export function setTheme(t: ThemeChoice) {
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

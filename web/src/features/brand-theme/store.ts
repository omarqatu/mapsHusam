import { useEffect } from 'react';
import { create } from 'zustand';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { platformContentApi, platformContentKeys } from '@/api/platformContent';
import { DEFAULT_THEME, THEME_KEY, parseTheme, sameTheme, serializeTheme, themeCss, type BrandTheme } from './model';

// The saved theme is applied on every page; while the admin edits, a draft is shown instead (live preview) and
// dropped when they leave the page without saving. The CSS of the saved theme is kept in this browser so
// public/theme-init.js can put it on before the first paint (no flash of the default colours).

const CACHE_THEME = 'psm-brand-theme';
const CACHE_CSS = 'psm-brand-css';
const STYLE_ID = 'psm-brand';

function readCache(): BrandTheme {
  try {
    return parseTheme(localStorage.getItem(CACHE_THEME));
  } catch {
    return DEFAULT_THEME;
  }
}

function remember(t: BrandTheme) {
  try {
    localStorage.setItem(CACHE_THEME, serializeTheme(t));
    localStorage.setItem(CACHE_CSS, themeCss(t));
  } catch {
    /* private mode: the server value still applies for this visit */
  }
}

interface BrandThemeState {
  saved: BrandTheme;
  draft: BrandTheme | null;
  setSaved: (t: BrandTheme) => void;
  setDraft: (t: BrandTheme | null) => void;
}

export const useBrandTheme = create<BrandThemeState>((set) => ({
  saved: readCache(),
  draft: null,
  setSaved: (saved) => set({ saved }),
  setDraft: (draft) => set({ draft }),
}));

/** The theme on screen now (the draft while an admin previews). */
export const useCurrentTheme = () => useBrandTheme((s) => s.draft ?? s.saved);

function apply(t: BrandTheme) {
  const css = themeCss(t);
  let el = document.getElementById(STYLE_ID);
  if (!css) {
    el?.remove();
  } else {
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
  }
  // Browser chrome (Android address bar, installed PWA title bar) follows the brand fill.
  const brand = css ? getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim() : '';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', brand || DEFAULT_THEME.primary);
}

export function useThemeQuery() {
  return useQuery({
    queryKey: platformContentKeys.item(THEME_KEY),
    queryFn: async () => {
      // A server older than "item: null for an unsaved key" answers 404: that also means "no theme saved".
      const res = await platformContentApi.get(THEME_KEY).catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) return { item: null };
        throw e;
      });
      return { theme: parseTheme(res.item?.content_value), updatedAt: res.item?.updated_at ?? null };
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/** Mounted once (App): applies the cached theme at once, then the server's, and every draft while previewing. */
export function BrandThemeSync() {
  const { data } = useThemeQuery();
  const setSaved = useBrandTheme((s) => s.setSaved);
  const current = useCurrentTheme();

  useEffect(() => {
    if (!data) return;
    remember(data.theme);
    if (!sameTheme(useBrandTheme.getState().saved, data.theme)) setSaved(data.theme);
  }, [data, setSaved]);

  useEffect(() => apply(current), [current]);
  return null;
}

/** Save the theme for everyone, or go back to the built-in one (`null`). */
export function useSaveTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: BrandTheme | null) =>
      t && !sameTheme(t, DEFAULT_THEME)
        ? platformContentApi.save(THEME_KEY, 'Brand theme', serializeTheme(t))
        : platformContentApi.remove(THEME_KEY),
    onSuccess: (_r, t) => {
      const next = t ?? DEFAULT_THEME;
      remember(next);
      useBrandTheme.setState({ saved: next, draft: null });
      return qc.invalidateQueries({ queryKey: platformContentKeys.item(THEME_KEY) });
    },
  });
}

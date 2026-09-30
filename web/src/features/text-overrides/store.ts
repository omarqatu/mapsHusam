import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18n from '@/i18n';
import { platformContentApi, platformContentKeys } from '@/api/platformContent';
import {
  NO_OVERRIDES,
  TEXTS_KEY,
  TEXT_KEYS,
  defaultText,
  parseTextOverrides,
  serializeTextOverrides,
  type Lang,
  type TextOverrides,
} from './model';

// The admin's rewording is put over the bundled texts in i18next: every `t('…')` in the app then shows it, with no
// change to any component. The last value is kept in this browser so a returning visitor sees the reworded text at once.

const CACHE_KEY = 'psm-text-overrides';

function readCache(): TextOverrides {
  try {
    return parseTextOverrides(localStorage.getItem(CACHE_KEY));
  } catch {
    return NO_OVERRIDES;
  }
}

/** The text of every allow-listed key in `lang` = the override, else the built-in text. Returns true if anything changed. */
export function applyTextOverrides(overrides: TextOverrides): boolean {
  let changed = false;
  for (const lang of ['ar', 'en'] as const) {
    for (const key of TEXT_KEYS) {
      const next = overrides[lang][key] ?? defaultText(lang, key);
      if (next && i18n.getResource(lang, 'translation', key) !== next) {
        i18n.addResource(lang, 'translation', key, next);
        changed = true;
      }
    }
  }
  // addResource does not tell mounted components; a language "change" to the same language does.
  if (changed) void i18n.changeLanguage(i18n.language);
  return changed;
}

function remember(o: TextOverrides) {
  try {
    localStorage.setItem(CACHE_KEY, serializeTextOverrides(o));
  } catch {
    /* private mode: the server value still applies for this visit */
  }
}

async function fetchOverrides(): Promise<TextOverrides> {
  const res = await platformContentApi.get(TEXTS_KEY);
  return parseTextOverrides(res.item?.content_value);
}

/** The stored overrides as a query (the admin page needs its loading / error state). */
export function useTextOverridesQuery() {
  return useQuery({
    queryKey: platformContentKeys.item(TEXTS_KEY),
    queryFn: fetchOverrides,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/** Mounted once (App): puts the cached rewording on at once, then the server's. */
export function TextOverridesSync() {
  const { data } = useTextOverridesQuery();
  useEffect(() => {
    applyTextOverrides(readCache());
  }, []);
  useEffect(() => {
    if (!data) return;
    remember(data);
    applyTextOverrides(data);
  }, [data]);
  return null;
}

/** Admin: store the wording; it applies here at once and to visitors within minutes. */
export function useSaveTextOverrides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (o: TextOverrides) =>
      // The label is stored data (shown to admins next to the raw key), not UI text.
      platformContentApi.save(TEXTS_KEY, 'نصوص الواجهة', serializeTextOverrides(o)),
    onSuccess: (_res, o) => {
      qc.setQueryData(platformContentKeys.item(TEXTS_KEY), o);
      remember(o);
      applyTextOverrides(o);
    },
  });
}

export type { Lang, TextOverrides };

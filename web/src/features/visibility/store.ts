import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { platformContentApi, platformContentKeys } from '@/api/platformContent';
import { ALL_TARGETS, type MapTarget } from '@/features/map/targets';
import { useAuthStore } from '@/store/authStore';
import {
  ALL_VISIBLE,
  excludedLayersParam,
  VISIBILITY_KEY,
  isLayerShown,
  isSectionShown,
  parseVisibility,
  serializeVisibility,
  type SectionId,
  type Visibility,
} from './model';

// One copy of the public visibility for the whole app. React reads it with the hooks below; plain code (the map's
// style function, list builders) with `getVisibility()`. The last value is kept in this browser so a returning visitor
// does not see hidden layers flash in before the request answers.

const CACHE_KEY = 'psm-visibility';

function readCache(): Visibility {
  try {
    return parseVisibility(localStorage.getItem(CACHE_KEY));
  } catch {
    return ALL_VISIBLE;
  }
}

export const useVisibilityStore = create<{ value: Visibility }>(() => ({ value: readCache() }));

export function setVisibility(value: Visibility) {
  useVisibilityStore.setState({ value });
  try {
    localStorage.setItem(CACHE_KEY, serializeVisibility(value));
  } catch {
    /* private mode / blocked storage: the server value still applies for this visit */
  }
}

export const getVisibility = () => useVisibilityStore.getState().value;
export const useVisibility = () => useVisibilityStore((s) => s.value);

/** `excludedLayers` for `/api/platform-stats`: the public figures leave hidden layers out (the same for admins). */
export const useExcludedLayers = () => useVisibilityStore((s) => excludedLayersParam(s.value));

// The rule, in one place: admins see everything (they edit hidden layers; the admin page and the layers panel mark
// what the public does not see); everyone else sees what the admin left on.
const viewerIsAdmin = () => useAuthStore.getState().user?.role === 'admin';
const useViewerIsAdmin = () => useAuthStore((s) => s.user?.role === 'admin');

/** For plain code (the map's style function, list builders outside React). */
export const layerShownToViewer = (t: MapTarget | string) =>
  viewerIsAdmin() || isLayerShown(getVisibility(), t);

/** A stable filter for lists of types; changes when the setting or the viewer changes. */
export function useLayerFilter(): (t: MapTarget | string) => boolean {
  const v = useVisibility();
  const admin = useViewerIsAdmin();
  return useCallback((t: MapTarget | string) => admin || isLayerShown(v, t), [v, admin]);
}

/** Every type the viewer may see, in registry order. */
export function useShownTargets(): MapTarget[] {
  const shown = useLayerFilter();
  return useMemo(() => ALL_TARGETS.filter(shown), [shown]);
}

export function useSectionShown(id: SectionId): boolean {
  const on = useVisibilityStore((s) => isSectionShown(s.value, id));
  return useViewerIsAdmin() || on;
}

/** Nothing saved yet (`item: null`) = everything visible. */
async function fetchVisibility(): Promise<Visibility> {
  const res = await platformContentApi.get(VISIBILITY_KEY);
  return parseVisibility(res.item?.content_value);
}

/** The stored setting as a query (the admin page needs its loading / error state). */
export function useVisibilityQuery() {
  return useQuery({
    queryKey: platformContentKeys.item(VISIBILITY_KEY),
    queryFn: fetchVisibility,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/** Mounted once (App): loads the setting, refreshes it now and then, and feeds the store. */
export function VisibilitySync() {
  const { data } = useVisibilityQuery();
  useEffect(() => {
    if (data) setVisibility(data);
  }, [data]);
  return null;
}

/** Admin: store a new choice; every open page picks it up on its next refresh, this one at once. */
export function useSaveVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Visibility) =>
      // The label is stored data (shown to admins next to the raw key), not UI text.
      platformContentApi.save(VISIBILITY_KEY, 'إظهار وإخفاء الطبقات والأقسام', serializeVisibility(v)),
    onSuccess: (_res, v) => {
      qc.setQueryData(platformContentKeys.item(VISIBILITY_KEY), v);
      setVisibility(v);
      // Lists fetched before the change were filtered with the old choice.
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'platform-content' });
    },
  });
}

/** Whether the map leaves out this layer for the current viewer. */
export const hiddenOnMap = (key: string) => !layerShownToViewer(key);

/**
 * Whether this viewer gets a listing's phone / WhatsApp: anyone signed in, a visitor only when the admin allows it.
 * The server enforces the same rule (the numbers are not in a visitor's answers); this only picks what to show instead.
 */
export function useCanSeeContact(): boolean {
  const signedIn = useAuthStore((s) => !!s.user?.token);
  const open = useVisibilityStore((s) => s.value.visitorContact);
  return signedIn || open;
}

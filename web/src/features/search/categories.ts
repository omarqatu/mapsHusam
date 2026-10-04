import { useMemo } from 'react';
import { LayoutGrid, type LucideIcon } from 'lucide-react';
import { layerShownToViewer, useLayerFilter } from '@/features/visibility/store';
import { groupedTargets } from '../map/extras/featured';
import type { TypeGroupId } from '../map/registry';
import { GROUP_ICON as TYPE_GROUP_ICON } from '../map/registry/groupIcons';
import { ALL_TARGETS, type MapTarget } from '../map/targets';

// The category browser of the page: 13 groups (legacy "branches") + "all", each holding some types.
// The type → group table is the `group` of each service in the map's `registry/services.ts` (one copy, shared).

export type GroupId = 'all' | TypeGroupId;

export const GROUP_ICON: Record<GroupId, LucideIcon> = { all: LayoutGrid, ...TYPE_GROUP_ICON };

const GROUPS = groupedTargets();
export const GROUP_IDS: GroupId[] = ['all', ...GROUPS.map((g) => g.group)];

export const isGroupId = (v: string | null): v is GroupId => !!v && (GROUP_IDS as string[]).includes(v);

type Shown = (t: MapTarget) => boolean;

/** The types shown for a group tab; "all" = every type. Types the admin hid from the public are left out. */
export function targetsInGroup(group: GroupId, shown: Shown = layerShownToViewer): MapTarget[] {
  const list = group === 'all' ? ALL_TARGETS : (GROUPS.find((g) => g.group === group)?.targets ?? []); // real estate first, like legacy
  return list.filter(shown);
}

/** "all" + every group that still has a type the viewer may see. */
export function shownGroupIds(shown: Shown = layerShownToViewer): GroupId[] {
  return GROUP_IDS.filter((g) => g === 'all' || targetsInGroup(g, shown).length > 0);
}

/** `shownGroupIds` that re-renders when the admin's visibility (or the viewer) changes. */
export function useShownGroupIds(): GroupId[] {
  const shown = useLayerFilter();
  return useMemo(() => shownGroupIds(shown), [shown]);
}

/** A group with exactly one type opens that type straight away (legacy: roads, fuel, landmarks, education, jobs). */
export function singleTargetOf(group: GroupId): MapTarget | null {
  if (group === 'all') return null;
  const list = targetsInGroup(group);
  return list.length === 1 ? list[0] : null;
}

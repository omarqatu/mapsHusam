import {
  Briefcase,
  BriefcaseMedical,
  Building2,
  Car,
  Ellipsis,
  Fuel,
  LayoutGrid,
  Landmark,
  PartyPopper,
  School,
  Signpost,
  Store,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { groupedTargets, type TypeGroupId } from '../map/extras/featured';
import { ALL_TARGETS, type MapTarget } from '../map/targets';

// The category browser of the page: 13 groups (legacy "branches") + "all", each holding some types.
// The type → group table lives in the map's `extras/featured.ts` (one copy, shared).

export type GroupId = 'all' | TypeGroupId;

export const GROUP_ICON: Record<GroupId, LucideIcon> = {
  all: LayoutGrid,
  roads: Signpost,
  fuel: Fuel,
  realestate: Building2,
  technicians: Wrench,
  health: BriefcaseMedical,
  vehicles: Car,
  professional: UserRound,
  events: PartyPopper,
  misc: Ellipsis,
  landmarks: Landmark,
  commercial: Store,
  education: School,
  jobs: Briefcase,
};

const GROUPS = groupedTargets();
export const GROUP_IDS: GroupId[] = ['all', ...GROUPS.map((g) => g.group)];

export const isGroupId = (v: string | null): v is GroupId => !!v && (GROUP_IDS as string[]).includes(v);

/** The types shown for a group tab; "all" = every type. */
export function targetsInGroup(group: GroupId): MapTarget[] {
  if (group === 'all') return ALL_TARGETS; // real estate first, like legacy
  return GROUPS.find((g) => g.group === group)?.targets ?? [];
}

/** A group with exactly one type opens that type straight away (legacy: roads, fuel, landmarks, education, jobs). */
export function singleTargetOf(group: GroupId): MapTarget | null {
  if (group === 'all') return null;
  const list = targetsInGroup(group);
  return list.length === 1 ? list[0] : null;
}

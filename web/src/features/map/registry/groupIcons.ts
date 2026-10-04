import {
  Briefcase,
  BriefcaseMedical,
  Building2,
  Car,
  Ellipsis,
  Fuel,
  Landmark,
  PartyPopper,
  School,
  Signpost,
  Store,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { TypeGroupId } from './types';

/** Icon of each type group (type filter, layer panel, category browser). A new group id fails to compile until it has one. */
export const GROUP_ICON: Record<TypeGroupId, LucideIcon> = {
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

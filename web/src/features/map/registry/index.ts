export { SERVICE_BY_KEY, SERVICE_REGISTRY, serviceLabelKey } from './services';
export { EDIT_PROFILES, TYPE_GROUP_IDS } from './types';
export type {
  EditProfile,
  ServiceDef,
  ServiceEntry,
  ServiceGroupId,
  ServiceTier,
  TypeGroupId,
} from './types';

/** `extras.featured.groups.<id>`: the display name of a type group in both locale files. */
export const groupLabelKey = (group: string) => `extras.featured.groups.${group}`;

// Types of the service registry (see `services.ts`). A leaf module: nothing here imports from the map feature.

/** How far out a service type's points are drawn (`TIER_RULES` in config.ts holds the resolutions). Default: `close`. */
export type ServiceTier = 'always' | 'medium' | 'close';

/** The groups of the type filter / category browser. `realestate` holds the three property layers, not services. */
export const TYPE_GROUP_IDS = [
  'roads',
  'fuel',
  'realestate',
  'technicians',
  'health',
  'vehicles',
  'professional',
  'events',
  'misc',
  'landmarks',
  'commercial',
  'education',
  'jobs',
] as const;
export type TypeGroupId = (typeof TYPE_GROUP_IDS)[number];
/** A group a service type can belong to. */
export type ServiceGroupId = Exclude<TypeGroupId, 'realestate'>;

/**
 * Which extra columns the editor offers on top of the common service fields (`edit/schema.ts` maps each profile to
 * its fields). Omitted = `standard`: the common fields only. `propertyService` (hotels, holiday villas) adds a price
 * in dollars and an area: they are services in `service_all` but are priced like property.
 */
export const EDIT_PROFILES = ['standard', 'roadBarrier', 'fuelStation', 'propertyService'] as const;
export type EditProfile = (typeof EDIT_PROFILES)[number];

/** What one service type is, everywhere. Adding a type = adding one entry to `SERVICE_REGISTRY`. */
export interface ServiceEntry {
  /** The `discriminator` value in `service_all`, the whitelisted layer name on the server, and the i18n suffix. */
  key: string;
  /** Emoji on the map, in lists and in the filters. */
  icon: string;
  /** Type-filter / category-browser group. */
  group: ServiceGroupId;
  tier?: ServiceTier;
  editProfile?: EditProfile;
  /** Arabic name written first into `search_tags` when a service of this type is saved (data: users search in Arabic). */
  tagName: string;
  /** Fixed extra Arabic keywords written into `search_tags`. */
  tagKeywords: string;
  /** `services.<key>`: the display name in both locale files. */
  labelKey: string;
}

/** What is written per type in `services.ts` (`labelKey` is derived). */
export type ServiceDef = Omit<ServiceEntry, 'labelKey'>;

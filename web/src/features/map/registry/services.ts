import serviceTypes from '../../../../../shared/service-types.json';
import type { ServiceDef, ServiceEntry } from './types';

// THE list of service types lives in `shared/service-types.json` at the repository root: server.js builds its layer
// whitelist (`ALLOWED_LAYERS`) from the same file, so the app and the server cannot disagree. Every other list of types
// in the app (map layers and styles, search targets, the layer panel / type filter groups, search tags, the editor's
// field sets, the admin user-service picker) derives from it.
//
// To add a type: add ONE entry to that file (keep the group's neighbours together) and its two display names in
// `locales/{ar,en}.json` under `services.<key>`. `registry.test.ts` checks every entry and every consumer. The order
// there is the order of the layer list and the search.
//
// Field guide: `group` = filter group; `tier` = draw distance (omit for `close`, see TIER_RULES in config.ts);
// `editProfile` = extra editor columns (omit for `standard`); `tagName` / `tagKeywords` = Arabic search terms.
// JSON has no literal types: the cast is checked value by value in registry.test.ts.
const DEFS = serviceTypes as readonly ServiceDef[];

/** `services.<key>`: where the display name of a service type lives (also for keys the map does not know). */
export const serviceLabelKey = (key: string) => `services.${key}`;

export const SERVICE_REGISTRY: readonly ServiceEntry[] = DEFS.map((d) => ({
  ...d,
  labelKey: serviceLabelKey(d.key),
}));

export const SERVICE_BY_KEY: ReadonlyMap<string, ServiceEntry> = new Map(
  SERVICE_REGISTRY.map((s) => [s.key, s]),
);

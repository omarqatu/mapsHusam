import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { GROUP_ICON } from './groupIcons';
import { EDIT_ONLY_LAYERS, POINT_TARGETS } from '../edit/schema';
import { buildSearchTags } from '../edit/attributes';
import { REAL_ESTATE_LAYERS, SERVICE_ALL_LAYER, SERVICE_TYPES, TIER_RULES } from '../config';
import { groupOf, groupedTargets } from '../extras/featured';
import { ALL_TARGETS, targetKey, targetLabelKey } from '../targets';
import { groupLabelKey, SERVICE_REGISTRY, serviceLabelKey, TYPE_GROUP_IDS } from './index';

// The service registry is the one list of service types. These tests fail when a type exists in one place but not in
// another: the registry, the locale label keys, the server whitelist, and every list derived from the registry.

const keys = SERVICE_REGISTRY.map((s) => s.key);
const serviceLabels = (locale: { services: Record<string, string> }) => Object.keys(locale.services).sort();
const dig = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);

/** `ALLOWED_LAYERS` of server.js, parsed read-only (repo root, one level above `web/`, where vitest runs). */
function serverWhitelist(): string[] | null {
  const path = resolve(process.cwd(), '../server.js');
  if (!existsSync(path)) return null;
  const src = readFileSync(path, 'utf8');
  const body = /const ALLOWED_LAYERS = \[([\s\S]*?)\n\];/.exec(src)?.[1];
  if (!body) throw new Error('ALLOWED_LAYERS not found in server.js: update the parser in registry.test.ts');
  const noComments = body.replace(/\/\/[^\n]*/g, '');
  return [...noComments.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('service registry', () => {
  it('has unique, non-empty entries with a valid group, tier and edit profile', () => {
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of SERVICE_REGISTRY) {
      expect(s.key, 'key').toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
      expect(s.icon.length, `${s.key} icon`).toBeGreaterThan(0);
      expect(s.tagName.trim(), `${s.key} tagName`).not.toBe('');
      expect(s.tagKeywords.trim(), `${s.key} tagKeywords`).not.toBe('');
      expect(TYPE_GROUP_IDS as readonly string[], `${s.key} group`).toContain(s.group);
      expect(s.group, `${s.key} group`).not.toBe('realestate');
      if (s.tier) expect(Object.keys(TIER_RULES), `${s.key} tier`).toContain(s.tier);
      expect(s.labelKey).toBe(serviceLabelKey(s.key));
    }
  });

  it('every type has its display name in ar and en, and the locales have no orphan service names', () => {
    for (const locale of [ar, en]) {
      expect(serviceLabels(locale)).toEqual([...keys].sort());
      for (const s of SERVICE_REGISTRY)
        expect(String(dig(locale, s.labelKey)).trim(), s.labelKey).not.toBe('');
    }
  });

  it('every group has a display name in ar and en and an icon', () => {
    for (const g of TYPE_GROUP_IDS) {
      expect(GROUP_ICON[g], g).toBeTruthy();
      for (const locale of [ar, en])
        expect(String(dig(locale, groupLabelKey(g))).trim(), g).not.toBe('undefined');
    }
  });

  it('matches the server whitelist (ALLOWED_LAYERS in server.js) exactly', () => {
    const whitelist = serverWhitelist();
    if (!whitelist) return; // web/ deployed on its own: nothing to compare with
    const notServices = new Set<string>([
      ...REAL_ESTATE_LAYERS.map((l) => l.typeName),
      ...Object.values(EDIT_ONLY_LAYERS).map((l) => l.typeName),
      SERVICE_ALL_LAYER.typeName,
    ]);
    const serverServices = whitelist.filter((l) => !notServices.has(l));
    expect(new Set(serverServices).size, 'duplicates in ALLOWED_LAYERS').toBe(serverServices.length);
    expect([...serverServices].sort()).toEqual([...keys].sort());
    for (const l of notServices) expect(whitelist, l).toContain(l);
  });

  it('every type is in exactly one group', () => {
    const grouped = groupedTargets().flatMap((g) => g.targets.map(targetKey));
    expect(grouped.sort()).toEqual(ALL_TARGETS.map(targetKey).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    for (const s of SERVICE_REGISTRY) {
      const inGroups = groupedTargets().filter((g) => g.targets.some((t) => targetKey(t) === s.key));
      expect(
        inGroups.map((g) => g.group),
        s.key,
      ).toEqual([s.group]);
      expect(groupOf({ kind: 'service', discriminator: s.key })).toBe(s.group);
    }
  });

  it('every consumer list is derived: config, targets, the editor and the search tags cover exactly the registry', () => {
    expect(SERVICE_TYPES.map((s) => s.key)).toEqual(keys);
    expect(ALL_TARGETS.filter((t) => t.kind === 'service').map(targetKey)).toEqual(keys);
    for (const s of SERVICE_REGISTRY) {
      const target = ALL_TARGETS.find((t) => targetKey(t) === s.key)!;
      expect(targetLabelKey(target)).toBe(s.labelKey);
    }
    const editable = POINT_TARGETS.filter((t) => t.workspace === 'services').map((t) => t.discriminator);
    expect(editable).toEqual(keys);
    for (const s of SERVICE_REGISTRY) {
      const tags = buildSearchTags(
        POINT_TARGETS.find((t) => t.discriminator === s.key)!,
        { name: '', des: '' },
      );
      expect(tags, s.key).toBe(`${s.tagName}، ${s.tagKeywords}`);
    }
  });

  it('only road barriers and fuel stations have extra editor columns', () => {
    const extra = SERVICE_REGISTRY.filter((s) => s.editProfile && s.editProfile !== 'standard').map(
      (s) => s.key,
    );
    expect(extra.sort()).toEqual(['fuel_stations', 'road_barriers']);
    const fields = (k: string) => POINT_TARGETS.find((t) => t.discriminator === k)!.fields.map((f) => f.name);
    expect(fields('road_barriers')).toEqual(expect.arrayContaining(['stop', 'stop2']));
    expect(fields('fuel_stations')).toEqual(expect.arrayContaining(['diesel', 'banzen95', 'banzen98']));
    expect(fields('plumber')).not.toContain('stop');
  });
});

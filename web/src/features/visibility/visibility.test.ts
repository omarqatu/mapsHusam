import { afterEach, describe, expect, it } from 'vitest';
import { ALL_TARGETS, targetKey } from '@/features/map/targets';
import { toResults } from '@/features/map/search/results';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';
import {
  ALL_VISIBLE,
  excludedLayersParam,
  isLayerShown,
  parseVisibility,
  realEstateOnly,
  sameVisibility,
  serializeVisibility,
  withLayers,
  withSection,
} from './model';
import { hiddenOnMap, layerShownToViewer, setVisibility } from './store';

describe('visibility model', () => {
  it('reads the stored JSON and drops what it does not know', () => {
    const v = parseVisibility(
      JSON.stringify({
        hiddenLayers: ['plumber', 'rent', 'no_such_layer', 3],
        hiddenSections: ['ticker', 'nope'],
      }),
    );
    expect([...v.hiddenLayers].sort()).toEqual(['plumber', 'rent']);
    expect([...v.hiddenSections]).toEqual(['ticker']);
  });

  it('treats nothing / garbage as "everything visible"', () => {
    for (const raw of [null, undefined, '', 'not json', '[]', '"x"', 'null'])
      expect(sameVisibility(parseVisibility(raw), ALL_VISIBLE)).toBe(true);
  });

  it('round-trips, sorted, so the same choice is stored the same way', () => {
    const v = withSection(withLayers(ALL_VISIBLE, ['plumber', 'carpenter'], false), 'stats', false);
    expect(serializeVisibility(v)).toBe(
      '{"hiddenLayers":["carpenter","plumber"],"hiddenSections":["stats"],"visitorContact":false}',
    );
    expect(sameVisibility(parseVisibility(serializeVisibility(v)), v)).toBe(true);
  });

  it('visitors see contact numbers only when the admin switched it on', () => {
    expect(parseVisibility('{"hiddenLayers":[]}').visitorContact).toBe(false);
    expect(parseVisibility('{"visitorContact":"yes"}').visitorContact).toBe(false);
    expect(parseVisibility('{"visitorContact":true}').visitorContact).toBe(true);
  });

  it('"real estate only" hides every service type and keeps the three property layers', () => {
    const v = realEstateOnly(ALL_VISIBLE);
    const shown = ALL_TARGETS.filter((t) => isLayerShown(v, t)).map(targetKey);
    expect(shown).toEqual(['rent', 'sale', 'land']);
  });

  it('shows / hides a group and a section', () => {
    const hidden = withLayers(ALL_VISIBLE, ['plumber', 'carpenter'], false);
    expect(isLayerShown(hidden, 'plumber')).toBe(false);
    expect(isLayerShown(withLayers(hidden, ['plumber'], true), 'plumber')).toBe(true);
    expect(withSection(withSection(ALL_VISIBLE, 'ticker', false), 'ticker', true).hiddenSections.size).toBe(
      0,
    );
  });

  it('sends the hidden layers to the platform statistics, nothing when none are hidden', () => {
    expect(excludedLayersParam(ALL_VISIBLE)).toBeUndefined();
    expect(excludedLayersParam(withLayers(ALL_VISIBLE, ['sale', 'plumber'], false))).toBe(
      '["plumber","sale"]',
    );
  });
});

describe('who sees what', () => {
  afterEach(() => {
    setVisibility(ALL_VISIBLE);
    useAuthStore.setState({ user: null });
  });
  const feature = (discriminator: string, id: number) => ({
    type: 'Feature',
    id: `service_all.${id}`,
    geometry: { type: 'Point', coordinates: [169000, 145000] },
    properties: { id, discriminator, name: `n${id}` },
  });
  const fc = {
    type: 'FeatureCollection',
    features: [feature('plumber', 1), feature('carpenter', 2)],
  } as never;

  it('a visitor loses hidden types everywhere results are built; the map leaves them out', () => {
    setVisibility(withLayers(ALL_VISIBLE, ['plumber'], false));
    expect(layerShownToViewer('plumber')).toBe(false);
    expect(hiddenOnMap('plumber')).toBe(true);
    expect(toResults(fc, null).map((r) => targetKey(r.target))).toEqual(['carpenter']);
  });

  it('an admin still sees them (to edit them)', () => {
    setVisibility(withLayers(ALL_VISIBLE, ['plumber'], false));
    useAuthStore.setState({ user: { user_id: 1, role: 'admin', token: 't' } as AuthUser });
    expect(layerShownToViewer('plumber')).toBe(true);
    expect(hiddenOnMap('plumber')).toBe(false);
    expect(toResults(fc, null)).toHaveLength(2);
  });
});

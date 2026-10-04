// @vitest-environment node
// Real GeoServer check of the editor's transport. NOT mocked. Runs only against the LOCAL dev stack
// (dev/README.md): backend on :3000 with GEOSERVER_TARGET at the local GeoServer, and the dev GeoServer login in
// the environment (VITE_GEOSERVER_DEV_PASSWORD, optional VITE_GEOSERVER_DEV_USER) — the password is never written in the repo:
//   cd web && VITE_LIVE_API=http://localhost:3000 VITE_GEOSERVER_DEV_PASSWORD=... npm test -- edit.live
// Every feature the test creates is deleted again (also when an assertion fails).
import GeoJSON from 'ol/format/GeoJSON';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchWfs } from '@/api/geoserver';
import { initialValues } from './attributes';
import { buildFeatureTx } from './buildTx';
import Polygon from 'ol/geom/Polygon';
import { toGeometryData, type GeometryData } from './geometry';
import { lookupRegional } from './regional';
import { editTargetById, serviceTarget, type EditTarget } from './schema';
import { saveFeature } from './transport';
import type { FeatureTx } from './tx';

const BASE = import.meta.env.VITE_LIVE_API;
const PASSWORD = import.meta.env.VITE_GEOSERVER_DEV_PASSWORD as string | undefined;
const USER = (import.meta.env.VITE_GEOSERVER_DEV_USER as string | undefined) ?? 'admin';
const nativeFetch = globalThis.fetch;
const credentials = { username: USER, password: PASSWORD ?? '' };

// A spot in the dev data (Al-Manara square); the shapes are tiny and far from real features.
const [X, Y] = [169463.41, 145767.99];
const geojson = new GeoJSON();
const created: { target: EditTarget; fid: string }[] = [];

/** The feature with this id — or, when GeoServer could not tell the new id (`ApartRent.null`), the one carrying the marker. */
async function readBack(
  target: EditTarget,
  fid: string | undefined,
  marker: { field: string; value: string },
  near = [X, Y],
) {
  const data = (await fetchWfs(
    {
      workspace: target.workspace,
      typeName: target.typeName,
      srsName: 'EPSG:28191',
      bbox: [near[0] - 60, near[1] - 60, near[0] + 60, near[1] + 60],
    },
    { timeoutMs: 15_000 },
  )) as { features: { id: string; properties: Record<string, unknown> }[] };
  return data.features.find((f) => (fid ? f.id === fid : f.properties[marker.field] === marker.value));
}

async function save(tx: FeatureTx) {
  const result = await saveFeature({ ...tx, credentials });
  if (!result.ok) throw new Error(`${tx.op} ${tx.layer.typeName}: ${result.reason} ${result.message ?? ''}`);
  return result;
}

const tinySquare = (dx: number): GeometryData => ({
  type: 'Polygon',
  coordinates: [
    [
      [X + dx, Y + 40],
      [X + dx + 8, Y + 40],
      [X + dx + 8, Y + 48],
      [X + dx, Y + 48],
      [X + dx, Y + 40],
    ],
  ],
});

/** What the editor sends for a drawn Polygon: converted to the type the table stores. */
const asStored = (dx: number, stored: 'MultiPolygon' | 'Polygon') => {
  const g = tinySquare(dx);
  return toGeometryData(new Polygon(g.type === 'Polygon' ? g.coordinates : []), stored)!;
};

describe.skipIf(!BASE || !PASSWORD)('live GeoServer — editor transport (insert / update / delete)', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
    // The proxy only lets an admin write (X-App-Token, sent by `saveFeature` from the session); the GeoServer login is on top.
    const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    useAuthStore.getState().setSession(user);
  });
  afterAll(async () => {
    for (const { target, fid } of created) {
      await saveFeature({
        op: 'delete',
        layer: { workspace: target.workspace, typeName: target.typeName },
        fid,
        properties: {},
        credentials,
      });
    }
    useAuthStore.setState({ user: null });
    globalThis.fetch = nativeFetch;
  });

  async function roundTrip(
    target: EditTarget,
    geometry: GeometryData,
    values: Record<string, string>,
    moved: GeometryData,
    markerField = 'name',
  ) {
    const marker = { field: markerField, value: `${values[markerField]}-${Date.now()}` };
    values = { ...values, [markerField]: marker.value };
    const regional = await lookupRegional([X, Y]);
    const inserted = buildFeatureTx({
      op: 'insert',
      target,
      geometry,
      values: initialValues(target, values),
      regional,
    });
    if (!inserted.ok) throw new Error(inserted.error);
    const result = await save(inserted.tx);
    if (result.fid) expect(result.fid).toMatch(new RegExp(`^${target.typeName}\\.\\d+$`));
    const row = await readBack(target, result.fid, marker);
    expect(row, 'the inserted feature is readable through WFS').toBeDefined();
    const fid = row!.id; // the real id, read back
    created.push({ target, fid });

    const updated = buildFeatureTx({
      op: 'update',
      target,
      featureId: fid,
      geometry: moved,
      values: { ...initialValues(target, row!.properties), ...values, phone: '' },
    });
    if (!updated.ok) throw new Error(updated.error);
    await save(updated.tx);
    const after = await readBack(target, fid, marker);
    expect(after).toBeDefined();
    return { fid, row: row!, after: after! };
  }

  it('service point: insert, move + edit + clear a field, delete', async () => {
    const target = serviceTarget('plumber');
    const { fid, row, after } = await roundTrip(
      target,
      { type: 'Point', coordinates: [X, Y] },
      { name: 'اختبار <&> "محرر"', phone: '0590000009', des: 'وصف', rating: '7' },
      { type: 'Point', coordinates: [X + 3, Y + 3] },
    );
    expect(row.properties).toMatchObject({ discriminator: 'plumber', status: 0, auto_status: 0, rating: 7 });
    expect(String(row.properties.name)).toMatch(/^اختبار <&> "محرر"-\d+$/); // hostile characters stored as text
    expect(row.properties.phone).toBe('0590000009');
    expect(String(row.properties.search_tags)).toContain('سباك');
    expect(after.properties.phone).toBeNull(); // cleared by the update
    expect(Number(after.properties.x_coord)).toBeCloseTo(X + 3, 1);
    expect(fid.startsWith('service_all.')).toBe(true);
    expect(await readBack(target, fid, { field: 'name', value: '' })).toBeDefined();
  });

  it('hotel: price, currency and area are saved and read back', async () => {
    const target = serviceTarget('hotels');
    const { row, after } = await roundTrip(
      target,
      { type: 'Point', coordinates: [X + 6, Y - 6] },
      { name: 'فندق اختبار', phone: '0590000009', price: '120.5', currency: 'ILS', area: '300' },
      { type: 'Point', coordinates: [X + 8, Y - 6] },
    );
    expect(row.properties).toMatchObject({
      discriminator: 'hotels',
      price: 120.5,
      currency: 'ILS',
      area: 300,
    });
    expect(after.properties).toMatchObject({ price: 120.5, currency: 'ILS', area: 300 }); // the update kept them
  });

  it('real-estate point (phone is kept on insert, X / Y in WGS84)', async () => {
    const target = editTargetById('point', 'rent')!;
    const { row, after } = await roundTrip(
      target,
      { type: 'Point', coordinates: [X + 10, Y] },
      { name: 'شقة اختبار', phone: '0590000009', price: '350', currency: 'JOD' },
      { type: 'Point', coordinates: [X + 12, Y] },
    );
    expect(row.properties).toMatchObject({ price: 350, currency: 'JOD', phone: '0590000009' });
    expect(Number(row.properties.X)).toBeGreaterThan(35);
    expect(Number(after.properties.x_coord)).toBeCloseTo(X + 12, 1);
  });

  it('road (MultiLineString from a drawn line)', async () => {
    const target = editTargetById('line', 'roads')!;
    const line = (dx: number): GeometryData => ({
      type: 'MultiLineString',
      coordinates: [
        [
          [X + dx, Y + 20],
          [X + dx + 15, Y + 25],
          [X + dx + 30, Y + 22],
        ],
      ],
    });
    const { row, after } = await roundTrip(
      target,
      line(0),
      { name: 'طريق اختبار', road_type: '2', one_way: '1' },
      line(5),
    );
    expect(row.properties).toMatchObject({ road_type: 2, one_way: 1, source: 0, cost: 0 });
    expect(String(after.properties.name)).toMatch(/^طريق اختبار-\d+$/);
  });

  it('land polygon (Polygon) and region polygon (Polygon wrapped to MultiPolygon)', async () => {
    const land = await roundTrip(
      editTargetById('polygon', 'land')!,
      tinySquare(0),
      { name: 'قطعة اختبار', price: '1000' },
      tinySquare(2),
    );
    expect(land.row.properties).toMatchObject({ price: 1000, status: 0 });

    const region = await roundTrip(
      editTargetById('polygon', 'locations')!,
      asStored(20, 'MultiPolygon'),
      { gov_a: 'اختبار', village_a: 'اختبار', location: 'اختبار' },
      asStored(22, 'MultiPolygon'),
      'gov_a',
    );
    expect(region.row.properties).toMatchObject({ village_a: 'اختبار', location: 'اختبار' });
    const parsed = geojson.readFeatures({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: region.fid,
          geometry: { type: 'MultiPolygon', coordinates: [] },
          properties: {},
        },
      ],
    });
    expect(parsed).toHaveLength(1);
  });

  it('a wrong GeoServer password is reported as `auth`, and nothing is written', async () => {
    const target = serviceTarget('plumber');
    const built = buildFeatureTx({
      op: 'insert',
      target,
      geometry: { type: 'Point', coordinates: [X + 50, Y + 50] },
      values: initialValues(target, { name: 'must-not-exist' }),
    });
    if (!built.ok) throw new Error(built.error);
    const result = await saveFeature({
      ...built.tx,
      credentials: { username: USER, password: `${PASSWORD}-wrong` },
    });
    expect(result).toEqual({ ok: false, reason: 'auth' });
  });

  it('a stale id is rejected instead of looking like success', async () => {
    const target = serviceTarget('plumber');
    const built = buildFeatureTx({ op: 'delete', target, featureId: 'service_all.999999999' });
    if (!built.ok) throw new Error(built.error);
    expect(await saveFeature({ ...built.tx, credentials })).toMatchObject({ ok: false, reason: 'rejected' });
  });
});

import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import MultiPolygon from 'ol/geom/MultiPolygon';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSearchTags, initialValues, parseValues, validateValues, ALWAYS_OPEN } from './attributes';
import { buildFeatureTx, coordinateColumns } from './buildTx';
import {
  fixed,
  representativePoint,
  round,
  toGeometryData,
  validateGeometry,
  type GeometryData,
} from './geometry';
import { NO_REGION, pickRegional } from './regional';
import { POINT_TARGETS, editTargetById, serviceTarget } from './schema';
import { saveFeature } from './transport';
import { featureFid, type FeatureTx } from './tx';
import { buildTransactionXml, escapeXml, geometryGml, parseTransactionResponse } from './wfst';

const point = (x = 169463.41, y = 145767.99): GeometryData => ({ type: 'Point', coordinates: [x, y] });
const square: GeometryData = {
  type: 'Polygon',
  coordinates: [
    [
      [100000, 100000],
      [100100, 100000],
      [100100, 100100],
      [100000, 100100],
      [100000, 100000],
    ],
  ],
};
const target = (kind: 'point' | 'line' | 'polygon', id: string) => editTargetById(kind, id)!;

describe('rounding', () => {
  it('fixed() never prints a negative zero', () => {
    expect(fixed(-0.0001, 2)).toBe('0.00');
    expect(fixed(-1.005, 1)).toBe('-1.0');
    expect(round(-0.0001, 2)).toBe(0);
    expect(Object.is(round(-0.0001, 2), -0)).toBe(false);
  });
  it('rounds grid columns to 2 dp and WGS84 to 6 dp (legacy)', () => {
    const cols = coordinateColumns(serviceTarget('plumber'), [169463.41234, 145767.99876]);
    expect(cols.x_coord).toBe(169463.41);
    expect(cols.y_coord).toBe(145768);
    expect(String(cols.x_global)).toMatch(/^35\.\d{1,6}$/);
    expect(String(cols.y_global)).toMatch(/^31\.\d{1,6}$/);
    expect('X' in cols).toBe(false);
  });
  it('real estate uses X / Y instead of x_global / y_global', () => {
    const cols = coordinateColumns(target('point', 'rent'), [169463.41, 145767.99]);
    expect(Object.keys(cols).sort()).toEqual(['X', 'Y', 'x_coord', 'y_coord']);
  });
  it('polygons and roads have no coordinate columns', () => {
    expect(coordinateColumns(target('polygon', 'land'), [1, 2])).toEqual({});
  });
});

describe('toGeometryData', () => {
  it('rounds to a millimetre', () => {
    const g = toGeometryData(new Point([169463.410000004, 145767.99]), 'Point');
    expect(g).toEqual({ type: 'Point', coordinates: [169463.41, 145767.99] });
  });
  it('wraps a drawn LineString into a MultiLineString', () => {
    const g = toGeometryData(
      new LineString([
        [1, 2],
        [3, 4],
      ]),
      'MultiLineString',
    );
    expect(g).toEqual({
      type: 'MultiLineString',
      coordinates: [
        [
          [1, 2],
          [3, 4],
        ],
      ],
    });
  });
  it('wraps a Polygon into a MultiPolygon for Location and keeps it a Polygon for land', () => {
    const p = new Polygon([
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 0],
      ],
    ]);
    expect(toGeometryData(p, 'MultiPolygon')?.type).toBe('MultiPolygon');
    expect(toGeometryData(p, 'Polygon')?.type).toBe('Polygon');
  });
  it('refuses a multi-part shape for a single-polygon table and a wrong type', () => {
    const multi = new MultiPolygon([
      [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
      [
        [
          [5, 5],
          [6, 5],
          [6, 6],
          [5, 5],
        ],
      ],
    ]);
    expect(toGeometryData(multi, 'Polygon')).toBeNull();
    expect(toGeometryData(new Point([1, 1]), 'Polygon')).toBeNull();
  });
  it('closes an open ring', () => {
    const g = toGeometryData(
      new Polygon([
        [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
      ]),
      'Polygon',
    );
    expect(g?.type === 'Polygon' && g.coordinates[0].length).toBe(4);
  });
});

describe('validateGeometry', () => {
  it('accepts a normal point, line and polygon', () => {
    expect(validateGeometry(point())).toBeNull();
    expect(
      validateGeometry({
        type: 'MultiLineString',
        coordinates: [
          [
            [1, 2],
            [3, 4],
          ],
        ],
      }),
    ).toBeNull();
    expect(validateGeometry(square)).toBeNull();
  });
  it('rejects NaN and far-away coordinates', () => {
    expect(validateGeometry(point(NaN, 1))).toBe('invalidCoordinates');
    expect(validateGeometry(point(2_000_000, 1))).toBe('outOfBounds');
  });
  it('rejects a one-point line and a zero-length line', () => {
    expect(validateGeometry({ type: 'MultiLineString', coordinates: [[[1, 2]]] })).toBe('lineTooShort');
    expect(
      validateGeometry({
        type: 'MultiLineString',
        coordinates: [
          [
            [1, 2],
            [1, 2],
          ],
        ],
      }),
    ).toBe('lineTooShort');
  });
  it('rejects a ring with too few points or no area', () => {
    expect(
      validateGeometry({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      }),
    ).toBe('ringTooShort');
    expect(
      validateGeometry({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 1],
            [2, 2],
            [0, 0],
          ],
        ],
      }),
    ).toBe('ringNoArea');
  });
  it('rejects a bow-tie (self-intersecting) polygon', () => {
    const bowTie: GeometryData = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [100, 100],
          [100, 0],
          [0, 100],
          [0, 0],
        ],
      ],
    };
    expect(validateGeometry(bowTie)).toBe('selfIntersecting');
  });
  it('checks every ring of a MultiPolygon', () => {
    const bad: GeometryData = {
      type: 'MultiPolygon',
      coordinates: [
        square.type === 'Polygon' ? square.coordinates : [],
        [
          [
            [0, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      ],
    };
    expect(validateGeometry(bad)).toBe('ringTooShort');
  });
});

describe('representativePoint', () => {
  it('is the first vertex of a line and inside a polygon', () => {
    expect(
      representativePoint({
        type: 'MultiLineString',
        coordinates: [
          [
            [7, 8],
            [9, 10],
          ],
        ],
      }),
    ).toEqual([7, 8]);
    const [x, y] = representativePoint(square);
    expect(x).toBeGreaterThan(100000);
    expect(x).toBeLessThan(100100);
    expect(y).toBeGreaterThan(100000);
    expect(y).toBeLessThan(100100);
  });
});

describe('featureFid', () => {
  it('accepts a prefixed or bare id and rejects another table', () => {
    expect(featureFid('LandSale', 'LandSale.12')).toBe('LandSale.12');
    expect(featureFid('LandSale', 12)).toBe('LandSale.12');
    expect(featureFid('LandSale', 'service_all.5')).toBeNull();
    expect(featureFid('LandSale', '')).toBeNull();
    expect(featureFid('LandSale', undefined)).toBeNull();
    expect(featureFid('LandSale', 'LandSale.')).toBeNull();
  });
});

describe('form values', () => {
  const svc = serviceTarget('plumber');
  it('fills the dialog from a feature: dates cut to the day, selects default to the first option', () => {
    const v = initialValues(target('point', 'rent'), {
      name: 'Ali',
      end_date: '2027-01-31T00:00:00Z',
      currency: 'XYZ',
      price: 5,
    });
    expect(v.name).toBe('Ali');
    expect(v.end_date).toBe('2027-01-31');
    expect(v.currency).toBe('USD');
    expect(v.price).toBe('5');
    expect(v.phone).toBe('');
  });
  it('parses numbers, trims text and turns empty into null', () => {
    const p = parseValues(svc, { name: '  Sami  ', rating: '7.5', phone: '', work_hours: ALWAYS_OPEN });
    expect(p.name).toBe('Sami');
    expect(p.rating).toBe(7.5);
    expect(p.phone).toBeNull();
  });
  it('roads: integer fields default to 0', () => {
    expect(parseValues(target('line', 'roads'), { name: 'X', road_type: '', one_way: '1' })).toMatchObject({
      road_type: 0,
      one_way: 1,
    });
  });
  it('validates numbers and rating ranges per layer', () => {
    expect(validateValues(svc, { rating: 'abc' })).toEqual({ rating: 'number' });
    expect(validateValues(svc, { rating: '11' })).toEqual({ rating: 'rating' });
    expect(validateValues(svc, { rating: '10' })).toEqual({});
    expect(validateValues(target('polygon', 'land'), { rating: '6' })).toEqual({ rating: 'rating' });
    expect(validateValues(target('point', 'rent'), { price: '-3' })).toEqual({ price: 'number' });
    expect(validateValues(target('line', 'roads'), { road_type: '1.5' })).toEqual({ road_type: 'integer' });
  });
});

describe('search tags', () => {
  it('service: type name, name, first 40 characters of the description, fixed keywords', () => {
    const tags = buildSearchTags(serviceTarget('plumber'), { name: 'أبو علي', des: 'x'.repeat(60) });
    expect(tags?.startsWith('سباك مواسيرجي، أبو علي، ' + 'x'.repeat(40) + '، ')).toBe(true);
    expect(tags).toContain('مواسير، حنفيات');
    expect(tags).not.toContain('x'.repeat(41));
  });
  it('unknown service type falls back to its key; empty parts are skipped', () => {
    expect(buildSearchTags(serviceTarget('zzz'), { name: '', des: '' })).toBe('zzz');
  });
  it('rent / sale are fixed sentences; land adds the description; regions and roads have none', () => {
    expect(buildSearchTags(target('point', 'rent'), {})).toContain('شقة للايجار');
    expect(buildSearchTags(target('point', 'sale'), {})).toContain('شقة للبيع');
    expect(buildSearchTags(target('polygon', 'land'), { des: 'قطعة' })).toMatch(
      /^أرض للبيع، قطعة، أرض للبيع، أراضي/,
    );
    expect(buildSearchTags(target('polygon', 'locations'), {})).toBeNull();
    expect(buildSearchTags(target('line', 'roads'), {})).toBeNull();
  });
});

describe('pickRegional', () => {
  const zone = new Feature({ gov_a: 'رام الله', village_a: 'البيرة', location: '' });
  zone.setGeometry(
    new Polygon([
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
        [0, 0],
      ],
    ]),
  );
  it('returns the containing polygon; empty texts become the default', () => {
    expect(pickRegional([zone], [50, 50])).toEqual({
      gov_a: 'رام الله',
      village_a: 'البيرة',
      location: 'غير محدد',
      found: true,
    });
  });
  it('returns the default when nothing contains the point', () => {
    expect(pickRegional([zone], [500, 500])).toBe(NO_REGION);
  });
});

describe('buildFeatureTx', () => {
  const region = { gov_a: 'رام الله', village_a: 'البيرة', location: 'المنارة', found: true };
  const insert = (t = serviceTarget('fuel_stations'), values = {}, g: GeometryData = point()) =>
    buildFeatureTx({
      op: 'insert',
      target: t,
      geometry: g,
      values: initialValues(t, values),
      regional: region,
      today: '2026-09-29',
    });

  it('insert (service): defaults, tags, region, discriminator, both coordinate systems', () => {
    const r = insert();
    if (!r.ok) throw new Error(r.error);
    const p = r.tx.properties;
    expect(r.tx.layer).toEqual({ workspace: 'services', typeName: 'service_all' });
    expect(p).toMatchObject({
      discriminator: 'fuel_stations',
      name: 'خدمة جديدة',
      rating: 5,
      work_hours: ALWAYS_OPEN,
      status: 0,
      auto_status: 0,
      start_date: '2026-09-29',
      gov_a: 'رام الله',
      village_a: 'البيرة',
      location_name: 'المنارة',
      diesel: '0',
      x_coord: 169463.41,
      y_coord: 145767.99,
    });
    expect(String(p.search_tags)).toContain('محطات الوقود');
    expect(r.tx.columns).toContain('banzen98');
  });
  it('insert (rent): region location fills `location`, phone is kept, price / area default to 0', () => {
    const t = target('point', 'rent');
    const r = insert(t, { phone: '0598000000' });
    if (!r.ok) throw new Error(r.error);
    expect(r.tx.properties).toMatchObject({
      location: 'المنارة',
      phone: '0598000000',
      price: 0,
      area: 0,
      currency: 'USD',
    });
    expect(r.tx.columns).toContain('phone');
  });
  it('insert (road): name default, pgRouting columns, region of the first vertex', () => {
    const t = target('line', 'roads');
    const r = insert(
      t,
      {},
      {
        type: 'MultiLineString',
        coordinates: [
          [
            [169000, 145000],
            [169100, 145100],
          ],
        ],
      },
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.tx.properties).toMatchObject({
      name: 'طريق جديد',
      road_type: 0,
      one_way: 0,
      source: 0,
      target: 0,
      cost: 0,
      gov_a: 'رام الله',
    });
  });
  it('insert (region polygon): typed texts win over "not specified"', () => {
    const t = target('polygon', 'locations');
    const r = insert(t, { gov_a: 'الخليل' }, square);
    if (!r.ok) throw new Error(r.error);
    expect(r.tx.properties).toMatchObject({ gov_a: 'الخليل', village_a: 'غير محدد', location: 'غير محدد' });
    expect('search_tags' in r.tx.properties).toBe(false);
  });
  it('update: writes non-empty values, clears the emptied ones, never blanks name or rating, recomputes tags', () => {
    const t = serviceTarget('plumber');
    const r = buildFeatureTx({
      op: 'update',
      target: t,
      featureId: 'service_all.12',
      geometry: point(),
      values: { ...initialValues(t, {}), name: '', rating: '', phone: '', des: 'جديد' },
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.tx.fid).toBe('service_all.12');
    expect(r.tx.properties.phone).toBeNull();
    expect('name' in r.tx.properties).toBe(false);
    expect('rating' in r.tx.properties).toBe(false);
    expect(String(r.tx.properties.search_tags)).toContain('جديد');
    expect(r.tx.properties.x_coord).toBe(169463.41);
  });
  it('update needs an id of the right table; delete too', () => {
    const t = target('polygon', 'land');
    expect(
      buildFeatureTx({ op: 'update', target: t, featureId: 'ApartRent.1', geometry: square, values: {} }),
    ).toEqual({ ok: false, error: 'noFid' });
    expect(buildFeatureTx({ op: 'delete', target: t, featureId: null })).toEqual({
      ok: false,
      error: 'noFid',
    });
    const del = buildFeatureTx({ op: 'delete', target: t, featureId: 'LandSale.3' });
    expect(del).toMatchObject({ ok: true, tx: { op: 'delete', fid: 'LandSale.3' } });
  });
  it('refuses an invalid shape before anything is built', () => {
    expect(insert(undefined, {}, point(NaN, 1))).toEqual({ ok: false, error: 'invalidCoordinates' });
    expect(buildFeatureTx({ op: 'insert', target: serviceTarget('plumber'), values: {} })).toEqual({
      ok: false,
      error: 'noGeometry',
    });
  });
  it('every point target lists `geom` and only known columns', () => {
    for (const t of POINT_TARGETS) {
      expect(t.insertColumns).toContain('geom');
      expect(new Set(t.insertColumns).size).toBe(t.insertColumns.length);
    }
  });
});

describe('WFS-T XML', () => {
  const layer = { workspace: 'services', typeName: 'service_all' };

  it('escapes markup and drops control characters', () => {
    expect(escapeXml(`a<b>&"c'\u0000d`)).toBe('a&lt;b&gt;&amp;&quot;c&apos;d');
  });

  it('insert: columns in schema order, empty ones left out, rating with one decimal, hostile text inert', () => {
    const tx: FeatureTx = {
      op: 'insert',
      layer,
      columns: ['geom', 'name', 'phone', 'rating', 'des'],
      properties: { name: '</services:name><x/>', phone: null, rating: 5, des: '' },
      geometry: point(1, 2),
    };
    const xml = buildTransactionXml(tx);
    expect(xml).toContain('<wfs:Insert><services:service_all xmlns:services="http://localhost/services">');
    expect(xml).toContain(
      '<services:geom><gml:Point srsName="EPSG:28191"><gml:coordinates>1,2</gml:coordinates></gml:Point></services:geom>',
    );
    expect(xml).toContain('<services:name>&lt;/services:name&gt;&lt;x/&gt;</services:name>');
    expect(xml).toContain('<services:rating>5.0</services:rating>');
    expect(xml).not.toContain('phone');
    expect(xml).not.toContain('<services:des>');
    expect(xml.indexOf('geom')).toBeLessThan(xml.indexOf('<services:name>'));
    expect(xml).not.toContain('<x/>');
  });

  it('update: properties, NULL for cleared columns, geometry, id filter', () => {
    const xml = buildTransactionXml({
      op: 'update',
      layer,
      fid: 'service_all.7',
      properties: { name: 'Ali & Sons', phone: null, rating: '7' },
      geometry: point(1, 2),
    });
    expect(xml).toContain(
      '<wfs:Update typeName="services:service_all" xmlns:services="http://localhost/services">',
    );
    expect(xml).toContain(
      '<wfs:Property><wfs:Name>services:name</wfs:Name><wfs:Value>Ali &amp; Sons</wfs:Value></wfs:Property>',
    );
    expect(xml).toContain('<wfs:Property><wfs:Name>services:phone</wfs:Name></wfs:Property>');
    expect(xml).toContain('<wfs:Value>7.0</wfs:Value>');
    expect(xml).toContain('<wfs:Name>services:geom</wfs:Name>');
    expect(xml).toContain('<ogc:Filter><ogc:FeatureId fid="service_all.7"/></ogc:Filter>');
  });

  it('delete: only the id filter', () => {
    const xml = buildTransactionXml({ op: 'delete', layer, fid: 'service_all.7', properties: {} });
    expect(xml).toContain('<wfs:Delete typeName="services:service_all"');
    expect(xml).toContain('fid="service_all.7"');
    expect(xml).not.toContain('gml:Point');
  });

  it('a request that lacks its id or shape is a programming error', () => {
    expect(() => buildTransactionXml({ op: 'delete', layer, properties: {} })).toThrow();
    expect(() => buildTransactionXml({ op: 'update', layer, fid: 'a.1', properties: {} })).toThrow();
  });

  it('GML: MultiLineString as posList members, MultiPolygon with one polygonMember per polygon', () => {
    expect(
      geometryGml({
        type: 'MultiLineString',
        coordinates: [
          [
            [1, 2],
            [3, 4],
          ],
          [
            [5, 6],
            [7, 8],
          ],
        ],
      }),
    ).toBe(
      '<gml:MultiLineString srsName="EPSG:28191">' +
        '<gml:lineStringMember><gml:LineString srsName="EPSG:28191"><gml:posList>1 2 3 4</gml:posList></gml:LineString></gml:lineStringMember>' +
        '<gml:lineStringMember><gml:LineString srsName="EPSG:28191"><gml:posList>5 6 7 8</gml:posList></gml:LineString></gml:lineStringMember>' +
        '</gml:MultiLineString>',
    );
    const ring = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
    ] as [number, number][];
    const multi = geometryGml({ type: 'MultiPolygon', coordinates: [[ring], [ring]] });
    expect(multi.match(/<gml:polygonMember>/g)).toHaveLength(2);
    expect(multi).toContain(
      '<gml:exterior><gml:LinearRing><gml:coordinates decimal="." cs="," ts=" ">0,0 10,0 10,10 0,0</gml:coordinates>',
    );
  });

  it('a polygon with a hole writes gml:interior', () => {
    const outer = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
    ] as [number, number][];
    const hole = [
      [2, 1],
      [4, 1],
      [4, 3],
      [2, 1],
    ] as [number, number][];
    expect(geometryGml({ type: 'Polygon', coordinates: [outer, hole] })).toContain('<gml:interior>');
  });
});

describe('parseTransactionResponse', () => {
  const ok = (extra: string, ins = 0, upd = 0, del = 0) =>
    `<?xml version="1.0"?><wfs:TransactionResponse xmlns:wfs="http://www.opengis.net/wfs" version="1.1.0"><wfs:TransactionSummary><wfs:totalInserted>${ins}</wfs:totalInserted><wfs:totalUpdated>${upd}</wfs:totalUpdated><wfs:totalDeleted>${del}</wfs:totalDeleted></wfs:TransactionSummary><wfs:TransactionResults/>${extra}</wfs:TransactionResponse>`;

  it('reads counts and the new id of an insert', () => {
    const xml = ok(
      '<wfs:InsertResults><wfs:Feature><ogc:FeatureId xmlns:ogc="http://www.opengis.net/ogc" fid="service_all.77"/></wfs:Feature></wfs:InsertResults>',
      1,
    );
    expect(parseTransactionResponse(xml)).toEqual({
      kind: 'done',
      inserted: 1,
      updated: 0,
      deleted: 0,
      fid: 'service_all.77',
    });
  });
  it('an id GeoServer could not determine (`Table.null`) is reported as unknown', () => {
    const xml = ok(
      '<wfs:InsertResults><wfs:Feature><ogc:FeatureId xmlns:ogc="http://www.opengis.net/ogc" fid="ApartRent.null"/></wfs:Feature></wfs:InsertResults>',
      1,
    );
    expect(parseTransactionResponse(xml)).toEqual({
      kind: 'done',
      inserted: 1,
      updated: 0,
      deleted: 0,
      fid: undefined,
    });
  });
  it('reads update and delete counts', () => {
    expect(parseTransactionResponse(ok('', 0, 1, 0))).toMatchObject({ kind: 'done', updated: 1 });
    expect(parseTransactionResponse(ok('', 0, 0, 0))).toMatchObject({ kind: 'done', updated: 0, deleted: 0 });
  });
  it('turns an ExceptionReport into a message, even with a "Exception" word in a saved value', () => {
    const xml =
      '<ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows" version="1.0.0"><ows:Exception exceptionCode="NoApplicableCode"><ows:ExceptionText>Bad &lt;thing&gt;</ows:ExceptionText></ows:Exception></ows:ExceptionReport>';
    expect(parseTransactionResponse(xml)).toEqual({ kind: 'exception', message: 'Bad <thing>' });
    expect(parseTransactionResponse(ok('<!-- NameException -->', 1)).kind).toBe('done');
  });
  it('anything that is not a transaction response is an exception', () => {
    expect(parseTransactionResponse('<html>502</html>')).toEqual({ kind: 'exception', message: '' });
  });
});

describe('saveFeature (mocked network — failure cases the real server cannot produce on demand)', () => {
  const tx: FeatureTx = {
    op: 'delete',
    layer: { workspace: 'services', typeName: 'service_all' },
    fid: 'service_all.1',
    properties: {},
    credentials: { username: 'u', password: 'p' },
  };
  afterEach(() => vi.restoreAllMocks());
  const respond = (status: number, body: string) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status }));

  it('refuses to send without credentials (nothing goes over the network)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    expect(await saveFeature({ ...tx, credentials: undefined })).toEqual({ ok: false, reason: 'auth' });
    expect(spy).not.toHaveBeenCalled();
  });
  it('sends the login only as a Basic header of this one request, credentials omitted', async () => {
    const spy = respond(
      200,
      '<wfs:TransactionResponse><wfs:TransactionSummary><wfs:totalDeleted>1</wfs:totalDeleted></wfs:TransactionSummary></wfs:TransactionResponse>',
    );
    expect(await saveFeature(tx)).toEqual({ ok: true, fid: undefined });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/geoserver-proxy/wfs');
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa('u:p')}`);
    expect(init?.credentials).toBe('omit');
    expect(String(init?.body)).not.toContain('"p"');
  });
  it('401 -> auth', async () => {
    respond(401, '');
    expect(await saveFeature(tx)).toEqual({ ok: false, reason: 'auth' });
  });
  it('an exception report -> rejected with the server text', async () => {
    respond(
      200,
      '<ows:ExceptionReport><ows:Exception><ows:ExceptionText>no such column</ows:ExceptionText></ows:Exception></ows:ExceptionReport>',
    );
    expect(await saveFeature(tx)).toEqual({ ok: false, reason: 'rejected', message: 'no such column' });
  });
  it('0 features changed -> rejected (a stale id must not look like success)', async () => {
    respond(
      200,
      '<wfs:TransactionResponse><wfs:TransactionSummary><wfs:totalDeleted>0</wfs:totalDeleted></wfs:TransactionSummary></wfs:TransactionResponse>',
    );
    expect(await saveFeature(tx)).toMatchObject({ ok: false, reason: 'rejected' });
  });
  it('network failure -> network', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    expect(await saveFeature(tx)).toEqual({ ok: false, reason: 'network' });
  });
  it('a non-Latin password does not throw', async () => {
    respond(401, '');
    expect(await saveFeature({ ...tx, credentials: { username: 'مدير', password: 'كلمة' } })).toEqual({
      ok: false,
      reason: 'auth',
    });
  });
});

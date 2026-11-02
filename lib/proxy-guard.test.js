// node --test lib/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visitorProxyCheck } from './proxy-guard.js';

const wfs = {
    service: 'WFS', version: '1.0.0', request: 'GetFeature', typeName: 'realestate:ApartRent',
    outputFormat: 'application/json', srsName: 'EPSG:28191',
};
const tile = { SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap', LAYERS: 'madeenati:WB_2023_10_18mbt', TILED: 'true' };

test('lets through the reads the map sends', () => {
    assert.deepEqual(visitorProxyCheck(wfs, '/realestate/ows', ['realestate:ApartRent']), { ok: true });
    assert.deepEqual(visitorProxyCheck(wfs, '/ows', ['realestate:ApartRent']), { ok: true });
    assert.deepEqual(visitorProxyCheck(tile, '/madeenati/wms', ['madeenati:WB_2023_10_18mbt']), { ok: true });
    assert.deepEqual(visitorProxyCheck({ service: 'WFS', request: 'GetCapabilities' }, '/ows', []), { ok: true });
});

test('a feature asked for by id alone (no layer parameter) is refused', () => {
    const byResource = { service: 'WFS', version: '2.0.0', request: 'GetFeature', resourceId: 'service_all.123' };
    assert.equal(visitorProxyCheck(byResource, '/ows', []).status, 403);
    const byStoredQuery = {
        service: 'WFS', version: '2.0.0', request: 'GetFeature',
        STOREDQUERY_ID: 'urn:ogc:def:query:OGC-WFS::GetFeatureById', ID: 'ApartRent.5',
    };
    assert.equal(visitorProxyCheck(byStoredQuery, '/ows', []).status, 403);
    // Even with a layer named, resourceId stays out (GeoServer would answer the id, not the filtered layer).
    assert.equal(visitorProxyCheck({ ...wfs, RESOURCEID: 'ApartRent.5' }, '/ows', ['realestate:ApartRent']).status, 403);
    assert.equal(visitorProxyCheck({ service: 'WFS', request: 'GetFeature' }, '/ows', []).status, 403);
});

test('parameter names are compared in any case: WPS, writes and other services are refused', () => {
    assert.equal(visitorProxyCheck({ SERVICE: 'WPS', REQUEST: 'Execute', identifier: 'x' }, '/ows', []).status, 403);
    assert.equal(visitorProxyCheck({ Service: 'wps', Request: 'GetCapabilities' }, '/ows', []).status, 403);
    assert.equal(visitorProxyCheck({ ...wfs, request: 'Transaction' }, '/ows', ['realestate:ApartRent']).status, 403);
    assert.equal(visitorProxyCheck({ ...wfs, request: 'LockFeature' }, '/ows', ['realestate:ApartRent']).status, 403);
    assert.equal(visitorProxyCheck({ ...wfs, request: 'GetPropertyValue' }, '/ows', ['realestate:ApartRent']).status, 403);
    assert.equal(visitorProxyCheck({ service: 'WCS', request: 'GetCoverage' }, '/ows', ['x']).status, 403);
    assert.equal(visitorProxyCheck({ request: 'GetFeature', typeName: 'a:b' }, '/ows', ['a:b']).status, 403);
});

test('the service follows a /wfs or /wms endpoint when the parameter is missing', () => {
    const { service, ...noService } = wfs;
    assert.equal(service, 'WFS');
    assert.deepEqual(visitorProxyCheck(noService, '/realestate/wfs', ['realestate:ApartRent']), { ok: true });
    assert.equal(visitorProxyCheck(noService, '/realestate/wms', ['realestate:ApartRent']).status, 403);
});

test('repeated, case-variant or nested parameters are refused so the forwarded query is exactly what was checked', () => {
    assert.equal(visitorProxyCheck({ ...wfs, TYPENAME: 'services:service_all' }, '/ows', ['realestate:ApartRent', 'services:service_all']).status, 400);
    assert.equal(visitorProxyCheck({ ...wfs, SERVICE: 'WPS' }, '/ows', ['realestate:ApartRent']).status, 400);
    assert.equal(visitorProxyCheck({ ...wfs, typeName: ['a:b', 'c:d'] }, '/ows', ['a:b', 'c:d']).status, 400);
    assert.equal(visitorProxyCheck({ ...wfs, x: { y: 'z' } }, '/ows', ['realestate:ApartRent']).status, 400);
});

test('parameter names GeoServer would fold into ASCII ("ſ" → S, "ı" → I) are refused', () => {
    const tileWith = (extra) => visitorProxyCheck({ ...tile, ...extra }, '/madeenati/wms', ['madeenati:WB_2023_10_18mbt']);
    assert.equal(tileWith({ 'layerſ': 'madeenati:service_all' }).status, 400);
    assert.equal(tileWith({ 'ſld_body': '<x/>' }).status, 400);
    assert.equal(tileWith({ 'reſourceıd': 'service_all.1' }).status, 400);
    assert.equal(visitorProxyCheck({ 'ſervice': 'WPS', request: 'Execute' }, '/ows', []).status, 400);
});

test('the path is judged raw: encoded dots or slashes are refused', () => {
    assert.equal(visitorProxyCheck(tile, '/%2e%2e/madeenati/wms', ['madeenati:WB_2023_10_18mbt']).status, 403);
    assert.equal(visitorProxyCheck(tile, '/madeenati%2Fwms', ['madeenati:WB_2023_10_18mbt']).status, 403);
    assert.equal(visitorProxyCheck(tile, '/../madeenati/wms', ['madeenati:WB_2023_10_18mbt']).status, 403);
});

test('only the map endpoints, and no external styles', () => {
    assert.equal(visitorProxyCheck(wfs, '/gwc/service/wmts', ['realestate:ApartRent']).status, 403);
    assert.equal(visitorProxyCheck(wfs, '/a/b/ows', ['realestate:ApartRent']).status, 403);
    assert.equal(visitorProxyCheck({ ...tile, SLD: 'http://evil/x.sld' }, '/madeenati/wms', ['madeenati:WB_2023_10_18mbt']).status, 403);
    assert.equal(visitorProxyCheck({ ...tile, sld_body: '<x/>' }, '/madeenati/wms', ['madeenati:WB_2023_10_18mbt']).status, 403);
});

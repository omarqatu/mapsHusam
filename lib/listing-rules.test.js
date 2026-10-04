// node --test lib/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    hiddenDiscriminators, isLayerHidden, parseHiddenLayers, publicListingCql, publicListingSql, publicProxyQuery,
} from './listing-rules.js';

const today = '2026-10-04';

test('reads the hidden layers of settings.visibility and drops anything unreadable', () => {
    assert.deepEqual([...parseHiddenLayers('{"hiddenLayers":["rent","plumber"],"hiddenSections":["ticker"]}')], ['rent', 'plumber']);
    assert.equal(parseHiddenLayers('not json').size, 0);
    assert.equal(parseHiddenLayers(null).size, 0);
    assert.deepEqual([...parseHiddenLayers('{"hiddenLayers":["ok","bad key\'",3]}')], ['ok']);
});

test('a property layer is hidden by its show & hide key, a service by its discriminator', () => {
    const hidden = parseHiddenLayers('{"hiddenLayers":["rent","plumber"]}');
    assert.equal(isLayerHidden('ApartRent', hidden), true);
    assert.equal(isLayerHidden('ApartSale', hidden), false);
    assert.equal(isLayerHidden('plumber', hidden), true);
    assert.deepEqual(hiddenDiscriminators(hidden), ['plumber']);
});

test('services keep unavailable rows, properties only available ones; ended rows never', () => {
    assert.equal(publicListingSql(false), '(status IN (0, 1) AND (end_date IS NULL OR end_date >= CURRENT_DATE))');
    assert.equal(publicListingSql(true), '(status = 0 AND (end_date IS NULL OR end_date >= CURRENT_DATE))');
    assert.equal(publicListingCql('LandSale', { hidden: new Set(), today }), "status = 0 AND (end_date IS NULL OR end_date >= '2026-10-04')");
});

test('service_all also leaves the hidden service types out', () => {
    const cql = publicListingCql('service_all', { hidden: new Set(['plumber', 'rent']), today });
    assert.equal(cql, "status IN (0,1) AND (end_date IS NULL OR end_date >= '2026-10-04') AND discriminator NOT IN ('plumber')");
});

test('the proxy folds bbox into the forced filter and keeps the other parameters', () => {
    const r = publicProxyQuery(
        { service: 'WFS', typeName: 'services:service_all', bbox: '1,2,3,4,EPSG:28191', outputFormat: 'application/json' },
        'service_all', { hidden: new Set(), today },
    );
    assert.equal(r.query.bbox, undefined);
    assert.equal(r.query.typeName, 'services:service_all');
    assert.equal(r.query.CQL_FILTER, "BBOX(geom,1,2,3,4,'EPSG:28191') AND status IN (0,1) AND (end_date IS NULL OR end_date >= '2026-10-04')");
});

test('the proxy refuses a client filter, a hidden layer and a bad bbox', () => {
    const opts = { hidden: new Set(['land']), today };
    assert.equal(publicProxyQuery({ CQL_FILTER: '1=1) OR (1=1' }, 'service_all', opts).status, 403);
    assert.equal(publicProxyQuery({ featureID: 'service_all.1' }, 'service_all', opts).status, 403);
    assert.equal(publicProxyQuery({ Filter: '<x/>' }, 'ApartRent', opts).status, 403);
    assert.equal(publicProxyQuery({}, 'LandSale', opts).status, 404);
    assert.equal(publicProxyQuery({ bbox: '1,2,x,4' }, 'ApartRent', opts).status, 400);
    assert.equal(publicProxyQuery({ bbox: "1,2,3,4,EPSG:1') OR ('" }, 'ApartRent', opts).status, 400);
    assert.equal(publicProxyQuery({ bbox: ['1,2,3,4', '5,6,7,8'] }, 'ApartRent', opts).status, 400);
});

// node --test lib/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    hiddenDiscriminators, isLayerHidden, isSubmissionLayerAllowed, parseHiddenLayers, parseVisibilitySettings,
    PROPERTY_WORK_HOURS, publicListingCql, publicListingSql, publicProxyQuery, submissionWorkHours,
    visibleSubmissionLayers, withoutContact,
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

test('submission choices and validation exclude hidden services and properties', () => {
    const allowed = ['plumber', 'electrician', 'ApartRent', 'ApartSale'];
    const hidden = new Set(['plumber', 'sale']);

    assert.deepEqual(visibleSubmissionLayers(allowed, hidden), ['electrician', 'ApartRent']);
    assert.equal(isSubmissionLayerAllowed('electrician', allowed, hidden), true);
    assert.equal(isSubmissionLayerAllowed('plumber', allowed, hidden), false);
    assert.equal(isSubmissionLayerAllowed('ApartSale', allowed, hidden), false);
    assert.equal(isSubmissionLayerAllowed('fuel_stations', allowed, hidden), false);
});

test('property submissions always use 24-hour work hours while service hours remain user-defined', () => {
    for (const layer of ['ApartRent', 'ApartSale', 'LandSale']) {
        assert.equal(submissionWorkHours(layer, '9-5'), PROPERTY_WORK_HOURS);
        assert.equal(submissionWorkHours(layer, null), PROPERTY_WORK_HOURS);
    }
    assert.equal(submissionWorkHours('plumber', '08:00-17:00'), '08:00-17:00');
    assert.equal(submissionWorkHours('plumber', ''), null);
});

test('services and properties keep unavailable rows but hide withdrawn and ended listings', () => {
    assert.equal(publicListingSql(false), '(status IN (0, 1) AND (end_date IS NULL OR end_date >= CURRENT_DATE))');
    assert.equal(publicListingSql(true), '(status IN (0, 1) AND (end_date IS NULL OR end_date >= CURRENT_DATE))');
    for (const layer of ['ApartRent', 'ApartSale', 'LandSale']) {
        assert.equal(
            publicListingCql(layer, { hidden: new Set(), today }),
            "status IN (0,1) AND (end_date IS NULL OR end_date >= '2026-10-04')",
        );
    }
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

test('visitors may see contact numbers only when the admin allows it', () => {
    assert.equal(parseVisibilitySettings('{"hiddenLayers":[]}').visitorContact, false);
    assert.equal(parseVisibilitySettings('{"visitorContact":true}').visitorContact, true);
    assert.equal(parseVisibilitySettings('{"visitorContact":"yes"}').visitorContact, false);
    assert.deepEqual(withoutContact({ id: 1, name: 'x', phone: '059', whatsapp: '97059' }), { id: 1, name: 'x' });
});

test('the proxy asks GeoServer for every column but the contact ones', () => {
    const r = publicProxyQuery({ typeName: 'services:service_all', propertyName: 'phone' }, 'service_all',
        { hidden: new Set(), today, columns: ['id', 'name', 'phone', 'whatsapp', 'geom'] });
    assert.equal(r.query.propertyName, 'id,name,geom');
});

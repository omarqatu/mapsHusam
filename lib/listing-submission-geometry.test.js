import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLandPolygon } from './listing-submission-geometry.js';

const square = {
    type: 'Polygon',
    coordinates: [[[169000, 145000], [169100, 145000], [169100, 145100], [169000, 145100], [169000, 145000]]],
};

test('accepts and rounds a closed land polygon within the Palestine Grid', () => {
    const result = parseLandPolygon({
        type: 'Polygon',
        coordinates: [[[169000.12345, 145000], [169100, 145000], [169100, 145100], [169000, 145100], [169000.12345, 145000]]],
    });
    assert.deepEqual(result.coordinates[0][0], [169000.123, 145000]);
    assert.deepEqual(result.coordinates[0][4], [169000.123, 145000]);
});

test('rejects malformed, out-of-bounds, unclosed, degenerate, complex, and oversized polygons', () => {
    assert.equal(parseLandPolygon(null), null);
    assert.equal(parseLandPolygon({ ...square, type: 'MultiPolygon' }), null);
    assert.equal(parseLandPolygon({ type: 'Polygon', coordinates: [square.coordinates[0], square.coordinates[0]] }), null);
    assert.equal(parseLandPolygon({ type: 'Polygon', coordinates: [[[1, 2], ...square.coordinates[0].slice(1)]] }), null);
    assert.equal(parseLandPolygon({ type: 'Polygon', coordinates: [[[169000, 145000], [169100, 145000], [169000, 145000], [169000, 145000]]]}), null);
    assert.equal(parseLandPolygon({
        type: 'Polygon',
        coordinates: [[[169000, 145000], [169100, 145100], [169100, 145000], [169000, 145100], [169000, 145000]]],
    }), null);
    assert.equal(parseLandPolygon({
        type: 'Polygon',
        coordinates: [[[169000, 145000], [169100, 145000], [169100, 145100], [169050, 145100], [169050, 145000], [169000, 145000]]],
    }), null);
    assert.equal(parseLandPolygon({
        type: 'Polygon',
        coordinates: [[[169000, 145000], [169000, 145000], [169100, 145100], [169000, 145100], [169000, 145000]]],
    }), null);
    assert.equal(
        parseLandPolygon({ type: 'Polygon', coordinates: [Array.from({ length: 501 }, () => [169000, 145000])] }),
        null,
    );
});

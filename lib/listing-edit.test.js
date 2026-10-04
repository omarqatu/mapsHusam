// node --test lib/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinPic, parseListingEdit, photoIdFromUrl, photoType, picList, whatsappNumber } from './listing-edit.js';

test('a provider edit keeps only valid fields, typed for SQL', () => {
    assert.deepEqual(parseListingEdit({ name: ' سباك <b> ', status: '2' }, 'plumber').value, { name: 'سباك b', status: 2 });
    assert.equal(parseListingEdit({ phone: '123' }, 'plumber').error !== undefined, true);
    assert.equal(parseListingEdit({ status: 3 }, 'plumber').error !== undefined, true);
    assert.equal(parseListingEdit({}, 'plumber').error !== undefined, true);
    assert.equal(parseListingEdit({ whatsapp: '0591234567' }, 'plumber').value.whatsapp, '+970591234567');
    assert.equal(parseListingEdit({ whatsapp: '' }, 'plumber').value.whatsapp, null);
});

test('a property has no hours and no point to move; a service has no area', () => {
    assert.ok(parseListingEdit({ work_hours: '8-5' }, 'ApartRent').error);
    assert.ok(parseListingEdit({ x_coord: 170000, y_coord: 140000 }, 'LandSale').error);
    assert.ok(parseListingEdit({ area: 100 }, 'plumber').error);
    assert.deepEqual(parseListingEdit({ area: 120, price: '450.6', currency: 'USD' }, 'ApartRent').value, { area: 120, price: 451, currency: 'USD' });
    assert.ok(parseListingEdit({ x_coord: 1, y_coord: 2 }, 'plumber').error);
    assert.deepEqual(parseListingEdit({ x_coord: '170000', y_coord: 140000 }, 'plumber').value, { x_coord: 170000, y_coord: 140000 });
});

test('a picture is recognised by its bytes, not by what the client says', () => {
    assert.equal(photoType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'jpg');
    assert.equal(photoType(Buffer.from('<html><script>alert(1)</script>')), null);
    assert.equal(photoType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'webp');
});

test('pic lists and uploaded picture urls', () => {
    assert.deepEqual(picList('a.jpg, b.jpg\n#|c.png'), ['a.jpg', 'b.jpg', 'c.png']);
    assert.equal(joinPic([]), null);
    const id = '209534ee-46fd-42a0-83ee-e159c457a6dd';
    assert.equal(photoIdFromUrl(`/api/listing-photos/${id}.png`), id);
    assert.equal(photoIdFromUrl(`https://evil/api/listing-photos/${id}.png`), null);
    assert.equal(whatsappNumber('abc'), null);
});

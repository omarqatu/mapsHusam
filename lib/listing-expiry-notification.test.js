import assert from 'node:assert/strict';
import test from 'node:test';
import { listingExpiryNotification } from './listing-expiry-notification.js';

test('the notice names the listing and its type and links the provider to their listings', () => {
    assert.deepEqual(
        listingExpiryNotification({
            layer: 'electrician',
            featureId: 18,
            userId: 7,
            endDate: '2026-10-03',
            name: 'كهربائي الأمل',
            typeName: 'فني كهرباء',
        }),
        {
            title: 'انتهاء الاشتراك',
            message: 'انتهى اشتراك فني كهرباء «كهربائي الأمل». تم إخفاء الإعلان عن الزوار.',
            type: 'warning',
            link: '/my-listings',
            dedupeKey: 'listing-expiry:electrician:18:7:2026-10-03',
        },
    );
});

test('a missing listing name falls back to the service or property type', () => {
    const notification = listingExpiryNotification({
        layer: 'ApartSale',
        featureId: 3,
        userId: 7,
        endDate: '2026-10-03T00:00:00.000Z',
        name: '',
        typeName: 'شقة للبيع',
    });
    assert.match(notification.message, /شقة للبيع «شقة للبيع»/);
    assert.equal(notification.dedupeKey, 'listing-expiry:ApartSale:3:7:2026-10-03');
});

test('a renewed subscription gets a distinct notification key', () => {
    const base = {
        layer: 'plumber',
        featureId: 10,
        userId: 7,
        name: 'سباكة الأمل',
        typeName: 'سباك',
    };
    const oldSubscription = listingExpiryNotification({ ...base, endDate: '2026-10-03' });
    const renewedSubscription = listingExpiryNotification({ ...base, endDate: '2026-12-03' });
    assert.notEqual(oldSubscription.dedupeKey, renewedSubscription.dedupeKey);
});

test('a date object produces the same stable subscription key as a date string', () => {
    const input = { layer: 'LandSale', featureId: 12, userId: 7, name: 'أرض للبيع', typeName: 'أرض للبيع' };
    const fromString = listingExpiryNotification({ ...input, endDate: '2026-10-03' });
    const fromDate = listingExpiryNotification({ ...input, endDate: new Date('2026-10-03T00:00:00.000Z') });
    assert.equal(fromDate.dedupeKey, fromString.dedupeKey);
});

test('a pg DATE (local midnight) keys on its own calendar day', () => {
    const n = listingExpiryNotification({ layer: 'plumber', featureId: 5, userId: 9, endDate: new Date(2026, 9, 3), typeName: 'سباك' });
    assert.equal(n.dedupeKey, 'listing-expiry:plumber:5:9:2026-10-03');
});

test('missing ids are refused instead of producing a key shared by every listing of the layer', () => {
    assert.throws(() => listingExpiryNotification({ layer: 'plumber', feature_id: 5, user_id: 9, end_date: '2026-10-03' }), TypeError);
});

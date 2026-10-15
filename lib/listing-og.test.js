// node --test lib/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listingId, listingSource, ogImage, ogText, withListingMeta } from './listing-og.js';

const origin = 'https://map.example.ps';
const html = `<html><head>
    <title>خريطة الخدمات الفلسطينية</title>
    <meta
      name="description"
      content="ابحث عن الخدمات"
    />
    <meta property="og:title" content="خريطة الخدمات الفلسطينية" />
    <meta
      property="og:description"
      content="الخدمات والعقارات"
    />
  </head><body></body></html>`;

test('a /l/<key> names a property table or a known service type, nothing else', () => {
    assert.deepEqual(listingSource('rent', ['plumber']), { table: 'ApartRent', isProperty: true });
    assert.deepEqual(listingSource('plumber', ['plumber']), { table: 'service_all', isProperty: false, discriminator: 'plumber' });
    for (const key of ['service_all', 'Location', 'RoadsTest', 'ApartRent', 'toString', '__proto__', 'nope']) {
        assert.equal(listingSource(key, ['plumber']), null, key);
    }
});

test('an id is a positive integer', () => {
    assert.equal(listingId('42'), 42);
    for (const bad of ['0', '-1', '1.5', '1e3', 'abc', '', '12345678901']) assert.equal(listingId(bad), null, bad);
});

test('the preview picture is one of the listing\'s own pictures, made absolute; otherwise the app icon', () => {
    assert.equal(ogImage('/api/listing-photos/ab12.webp,/pic/x.jpg', origin), `${origin}/api/listing-photos/ab12.webp`);
    assert.equal(ogImage('#, https://evil.example/x.jpg ,/pic/a.png', origin), `${origin}/pic/a.png`);
    assert.equal(ogImage(`${origin}/pic/b.jpg`, origin), `${origin}/pic/b.jpg`);
    assert.equal(ogImage('/pic/../server.js', origin), `${origin}/icons/icon-512.png`);
    assert.equal(ogImage(null, origin), `${origin}/icons/icon-512.png`);
});

test('title and description read like the card, with the price and no contact', () => {
    const row = { location: 'رام الله', price: 1200, currency: 'USD', phone: '0599000000', whatsapp: '0599000000' };
    const { title, description } = ogText(row, 'شقة للإيجار');
    assert.equal(title, 'شقة للإيجار في رام الله');
    assert.equal(description, 'شقة للإيجار · رام الله · 1,200 دولار');
    assert.equal(ogText({ name: 'أبو سامي', des: 'تمديدات وصيانة' }, 'سباك').title, 'أبو سامي');
    assert.equal(ogText({ name: 'أبو سامي', des: 'تمديدات وصيانة' }, 'سباك').description, 'سباك — تمديدات وصيانة');
});

test('the page gets the listing\'s tags in place of the site\'s, every value escaped', () => {
    const out = withListingMeta(html, {
        title: 'أبو "سامي" <b>',
        description: 'سباك & صيانة',
        url: `${origin}/l/plumber/7`,
        image: `${origin}/icons/icon-512.png`,
        siteName: 'خريطة الخدمات',
    });
    assert.match(out, /<title>أبو &quot;سامي&quot; &lt;b&gt; · خريطة الخدمات<\/title>/);
    assert.equal(out.match(/og:title/g).length, 1);
    assert.equal(out.match(/og:description/g).length, 1);
    assert.equal(out.match(/name="description"/g).length, 1);
    assert.match(out, /<meta property="og:description" content="سباك &amp; صيانة" \/>/);
    assert.match(out, /<meta property="og:url" content="https:\/\/map\.example\.ps\/l\/plumber\/7" \/>/);
    assert.match(out, /<meta name="twitter:card" content="summary_large_image" \/>/);
    assert.doesNotMatch(out, /<b>/);
});

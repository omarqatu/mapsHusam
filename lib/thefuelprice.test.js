// node --test lib/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { arabicDate, parseFuelPrices } from './thefuelprice.js';

const page = readFileSync(new URL('./fixtures/thefuelprice-ar.html', import.meta.url), 'utf8');

test('reads every price row of the real page with its previous price and start date', () => {
    const r = parseFuelPrices(page);
    const byKey = Object.fromEntries(r.items.map((i) => [i.key, i]));
    assert.equal(r.items.length, 7);
    assert.deepEqual(byKey['fuel-95'], { key: 'fuel-95', value: 8.17, previous: 8.15, unit: 'liter', effectiveFrom: '2026-10-01' });
    assert.equal(byKey['fuel-98'].value, 9.73);
    assert.equal(byKey['fuel-98'].previous, 9.21);
    assert.equal(byKey['fuel-diesel'].value, 8.99);
    assert.equal(byKey['fuel-diesel'].previous, 8.39);
    assert.equal(byKey.kas.value, 8.99);
    assert.equal(byKey['fuel-gas-small5'].value, 38);
    assert.equal(byKey['fuel-gas-cylinder'].value, 90);
    assert.equal(byKey['fuel-gas-large'].value, 360);
    assert.equal(byKey['fuel-gas-large'].previous, 340);
    assert.equal(byKey['fuel-gas-large'].unit, 'cylinder');
    assert.equal(r.sourceUpdatedOn, '2026-10-07');
});

test('a falling price (Unicode minus) gives a higher previous price', () => {
    const down = page.replace('<span class="num">&#x2B;0.02</span>', '<span class="num">\u22120.17</span>');
    assert.equal(parseFuelPrices(down).items.find((i) => i.key === 'fuel-95').previous, 8.34);
});

test('a page that changed shape or carries absurd numbers is refused, not guessed', () => {
    assert.equal(parseFuelPrices('<html>maintenance</html>'), null);
    const absurd = page.replace('<td class="price fw-semibold">8.17</td>', '<td class="price fw-semibold">817</td>');
    assert.equal(parseFuelPrices(absurd).items.some((i) => i.key === 'fuel-95'), false);
    // fewer than four recognised rows = the site changed
    const rows = page.split('<tr class=');
    assert.equal(parseFuelPrices(rows.slice(0, 4).join('<tr class=') + '</tbody></table>'), null);
});

test('Arabic dates', () => {
    assert.equal(arabicDate('حدّثت أسعار المشتقات يوم الجمعة, 4 سبتمبر 2026'), '2026-09-04');
    assert.equal(arabicDate('01 أيلول 2026'), '2026-09-01');
    assert.equal(arabicDate('no date'), null);
});

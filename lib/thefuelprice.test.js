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
    assert.deepEqual(byKey['fuel-95'], { key: 'fuel-95', value: 8.15, previous: 7.99, unit: 'liter', effectiveFrom: '2026-09-01' });
    assert.equal(byKey['fuel-98'].value, 9.21);
    assert.equal(byKey['fuel-diesel'].value, 8.39);
    assert.equal(byKey['fuel-diesel'].previous, 8.56);
    assert.equal(byKey.kas.value, 8.39);
    assert.equal(byKey['fuel-gas-small5'].value, 36);
    assert.equal(byKey['fuel-gas-cylinder'].value, 85);
    assert.equal(byKey['fuel-gas-large'].value, 340);
    assert.equal(byKey['fuel-gas-large'].unit, 'cylinder');
    assert.equal(r.sourceUpdatedOn, '2026-09-04');
});

test('a page that changed shape or carries absurd numbers is refused, not guessed', () => {
    assert.equal(parseFuelPrices('<html>maintenance</html>'), null);
    assert.equal(parseFuelPrices(page.replaceAll('<td>لتر</td>', '<td>لتر</td>').replace(/value='8\.15'/g, "value='815'").replace('</span> 8.15', '</span> 815')).items.some((i) => i.key === 'fuel-95'), false);
    // fewer than four recognised rows = the site changed
    assert.equal(parseFuelPrices(page.split('<tr>').slice(0, 4).join('<tr>') + '</tbody></table>'), null);
});

test('Arabic dates', () => {
    assert.equal(arabicDate('حدّثت أسعار المشتقات يوم الجمعة, 4 سبتمبر 2026'), '2026-09-04');
    assert.equal(arabicDate('01 أيلول 2026'), '2026-09-01');
    assert.equal(arabicDate('no date'), null);
});

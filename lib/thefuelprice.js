// Reads the Palestinian retail fuel prices from https://www.thefuelprice.com/Fps/ar (server-side; the app shows them as the
// fuel card of the information centre). The page is server-rendered HTML (Arabic written as HTML entities) whose first
// price table has one row per product:
//   <tr class="trend-up"><td>بنزين 95</td><td class="price fw-semibold">8.17</td><td>لتر</td>
//       <td class="trend-text"><i …></i> <span class="num">+0.02</span></td><td>01 أكتوبر 2026</td></tr>
// and a chip «حدّثت الأسعار يوم الأربعاء، 7 أكتوبر 2026». The previous price is the price minus the change.
// Nothing here trusts the page: unknown rows are ignored, every value must sit in a plausible range, and a page that
// yields fewer than MIN_ROWS known rows is treated as changed (null), so the caller keeps the last good prices.

export const SOURCE_URL = 'https://www.thefuelprice.com/Fps/ar';
const MIN_ROWS = 4;

/** Row name (as the site writes it) → our row id, unit and the range a real price must fall in (shekels). */
const KNOWN = [
    { key: 'fuel-95', name: /بنزين\s*95/, unit: 'liter', min: 3, max: 30 },
    { key: 'fuel-98', name: /بنزين\s*98/, unit: 'liter', min: 3, max: 30 },
    { key: 'fuel-diesel', name: /^(سولار|ديزل)/, unit: 'liter', min: 3, max: 30 },
    { key: 'kas', name: /^(ال)?كاز/, unit: 'liter', min: 3, max: 30 },
    { key: 'fuel-gas-small5', name: /غاز.*(?<!\d)5(?!\d)\s*كغ/, unit: 'cylinder', min: 5, max: 150 },
    { key: 'fuel-gas-cylinder', name: /غاز.*(?<!\d)12(?!\d)\s*كغ/, unit: 'cylinder', min: 10, max: 400 },
    { key: 'fuel-gas-large', name: /غاز.*(?<!\d)48(?!\d)\s*كغ/, unit: 'cylinder', min: 40, max: 1500 },
];

const MONTHS = {
    يناير: 1, كانون_الثاني: 1, فبراير: 2, شباط: 2, مارس: 3, آذار: 3, أبريل: 4, ابريل: 4, نيسان: 4, مايو: 5, أيار: 5,
    يونيو: 6, حزيران: 6, يوليو: 7, تموز: 7, أغسطس: 8, اغسطس: 8, آب: 8, سبتمبر: 9, أيلول: 9, أكتوبر: 10,
    تشرين_الأول: 10, نوفمبر: 11, تشرين_الثاني: 11, ديسمبر: 12, كانون_الأول: 12,
};

/** "01 سبتمبر 2026" / "4 سبتمبر 2026" inside a text → "2026-09-01"; null when there is no such date. */
export function arabicDate(text) {
    const m = /(\d{1,2})\s+([^\s\d,،]+)\s+(\d{4})/.exec(String(text).replace(/_/g, ' '));
    if (!m) return null;
    const month = MONTHS[m[2].replace(/\s+/g, '_')];
    if (!month) return null;
    return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const decode = (s) => s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const strip = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const UNITS = /^(لتر|أسطوانة)$/;

/** @returns {{ items: { key: string, value: number, previous: number | null, unit: 'liter' | 'cylinder', effectiveFrom: string | null }[], sourceUpdatedOn: string | null } | null} */
export function parseFuelPrices(page) {
    const html = decode(String(page));
    const items = [];
    for (const [row] of html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)) {
        // Only the current-prices table has five cells with the unit in the third; the history tables differ.
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => strip(c[1]));
        if (cells.length !== 5 || !UNITS.test(cells[2])) continue;
        const [label, price, , change, from] = cells;
        const known = KNOWN.find((k) => k.name.test(label));
        if (!known || items.some((i) => i.key === known.key)) continue;
        const value = parseFloat(/^\d+(?:\.\d+)?$/.exec(price)?.[0] ?? '');
        if (!Number.isFinite(value) || value < known.min || value > known.max) continue;
        const delta = parseFloat(/^([+\-\u2212])\s*(\d+(?:\.\d+)?)$/.exec(change)?.slice(1).join('').replace('\u2212', '-') ?? '');
        const old = Number.isFinite(delta) ? Math.round((value - delta) * 100) / 100 : NaN;
        items.push({
            key: known.key,
            value,
            previous: Number.isFinite(old) && old >= known.min && old <= known.max ? old : null,
            unit: known.unit,
            effectiveFrom: arabicDate(from),
        });
    }
    if (items.length < MIN_ROWS) return null;
    const updated = /حدّ?ثت الأسعار[^<]*/.exec(html)?.[0] ?? '';
    return { items, sourceUpdatedOn: arabicDate(updated) };
}

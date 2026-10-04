import type { SearchResult } from './results';

interface PrintLabels {
  title: string;
  date: string;
  columns: [string, string, string, string, string];
  dir: 'rtl' | 'ltr';
  lang: string;
}

/**
 * Print-friendly results table in a new window. Built with DOM calls (textContent) — legacy wrote HTML strings with
 * data in them, and its `\${new Date()}` typo printed the literal text instead of the date.
 */
export function printResults(
  items: SearchResult[],
  typeTitle: (r: SearchResult) => string,
  labels: PrintLabels,
): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  const d = w.document;
  d.documentElement.lang = labels.lang;
  d.documentElement.dir = labels.dir;
  d.title = labels.title;

  const style = d.createElement('style');
  style.textContent =
    'body{font-family:"Segoe UI",Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:start}th{background:#f8f9fa}h1{font-size:20px;text-align:center}';
  d.head.appendChild(style);

  const h1 = d.createElement('h1');
  h1.textContent = labels.title;
  const p = d.createElement('p');
  p.textContent = labels.date;
  const table = d.createElement('table');
  const head = d.createElement('tr');
  ['#', ...labels.columns.slice(1)].forEach((c) => {
    const th = d.createElement('th');
    th.textContent = c;
    head.appendChild(th);
  });
  table.appendChild(head);

  items.forEach((r, i) => {
    const props = r.props;
    const text = (k: string) => (props[k] === null || props[k] === undefined ? '' : String(props[k]));
    const cells = [
      String(i + 1),
      text('name'),
      typeTitle(r),
      [text('location_name') || text('location'), text('village_a'), text('gov_a')]
        .filter(Boolean)
        .join(' - '),
      text('phone') || text('whatsapp'),
    ];
    const tr = d.createElement('tr');
    cells.forEach((c) => {
      const td = d.createElement('td');
      td.textContent = c;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  d.body.append(h1, p, table);
  w.focus();
  w.print();
  return true;
}

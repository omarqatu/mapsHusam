import { afterEach, describe, expect, it, vi } from 'vitest';
import Point from 'ol/geom/Point';
import type { Props } from '../popup/featureModel';
import type { SearchResult } from './results';
import type { MapTarget } from '../targets';
import { isPlatformRequest, printResults } from './printResults';

const result = (
  id: string,
  props: Props,
  target: MapTarget = { kind: 'service', discriminator: 'electrician' },
): SearchResult => ({
  key: `${target.kind === 'service' ? target.discriminator : target.layer}:${id}`,
  target,
  id,
  props,
  geometry: new Point([0, 0]),
  center: [0, 0],
  extent: [0, 0, 0, 0],
  rating: 0,
});

afterEach(() => vi.restoreAllMocks());

describe('printResults', () => {
  it('prints phone and WhatsApp separately and labels platform-request listings', () => {
    const doc = document.implementation.createHTMLDocument();
    const printWindow = { document: doc, focus: vi.fn(), print: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(printWindow);

    const direct = result('1', { name: 'Direct', phone: '0591111111', whatsapp: '00970591111111' });
    const platform = result('2', { name: 'Platform', phone: '0592222222', whatsapp: '00970592222222' });
    const linked = new Map([['electrician', new Set(['2'])]]);
    const isRequest = (r: SearchResult) => isPlatformRequest(r, linked, true);

    expect(
      printResults(
        [direct, platform],
        () => 'Electrician',
        {
          title: 'Report',
          date: 'Today',
          columns: ['#', 'Name', 'Type', 'Place', 'Phone', 'WhatsApp', 'Contact method'],
          platformRequest: 'You can request the service or property through the platform',
          dir: 'ltr',
          lang: 'en',
        },
        isRequest,
      ),
    ).toBe(true);

    const rows = [...doc.querySelectorAll('table tr')].map((row) =>
      [...row.querySelectorAll('th, td')].map((cell) => cell.textContent),
    );
    expect(rows[1]).toEqual(['1', 'Direct', 'Electrician', '', '0591111111', '00970591111111', '']);
    expect(rows[2]).toEqual([
      '2',
      'Platform',
      'Electrician',
      '',
      '',
      '',
      'You can request the service or property through the platform',
    ]);
    expect(printWindow.print).toHaveBeenCalledOnce();
  });

  it('recognizes linked property listings by their property table name', () => {
    const property = result('42', { phone: '0593333333', whatsapp: '00970593333333' }, {
      kind: 'realEstate',
      layer: 'sale',
    });
    const linked = new Map([['ApartSale', new Set(['42'])]]);

    expect(isPlatformRequest(property, linked, true)).toBe(true);
  });
});

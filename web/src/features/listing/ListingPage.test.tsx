import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import i18n from '@/i18n';
import ListingPage from './ListingPage';
import { listingPath, whatsappShareLink } from './link';
import { closestOthers, pricePerMeter } from './model';
import Point from 'ol/geom/Point';
import type { SearchResult } from '../map/search/results';

let batchBodies: unknown[] = [];
let features: unknown[] = [];

beforeAll(async () => {
  await i18n.changeLanguage('en');
});
afterAll(async () => {
  await i18n.changeLanguage('ar');
});
afterEach(() => {
  vi.unstubAllGlobals();
  batchBodies = [];
});

function show(path: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://x').pathname;
      if (url === '/api/search-features-batch') {
        batchBodies.push(JSON.parse(String(init?.body)));
        return Promise.resolve(Response.json({ type: 'FeatureCollection', features }));
      }
      return Promise.resolve(Response.json({}));
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/l/:key/:id" element={<ListingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('a listing page', () => {
  it('reads the one listing through the public batch and titles the page with it', async () => {
    features = [
      {
        type: 'Feature',
        id: 'ApartRent.42',
        geometry: { type: 'Point', coordinates: [170000, 146000] },
        properties: { id: 42, location: 'Ramallah', price: 400 },
      },
    ];
    show('/l/rent/42');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Flat for rent in Ramallah' }),
    ).toBeInTheDocument();
    expect(batchBodies[0]).toMatchObject({ workspace: 'realestate', ids: ['42'] });
  });

  it('shows the pictures large with a counter and thumbnails, the key facts and the price per metre', async () => {
    features = [
      {
        type: 'Feature',
        id: 'LandSale.9',
        geometry: { type: 'Point', coordinates: [170000, 146000] },
        properties: {
          fid: 9,
          location: 'Al-Masyoun',
          price: 900000,
          currency: 'USD',
          area: 600,
          des: 'Empty commercial land',
          pic: 'https://a.ps/1.jpg,https://a.ps/2.jpg',
        },
      },
    ];
    show('/l/land/9');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Picture 2' })).toBeInTheDocument();
    expect(screen.getByText('Price per m²').nextElementSibling).toHaveTextContent('1,500');
    expect(screen.getByRole('heading', { level: 2, name: 'Description' })).toBeInTheDocument();
    expect(screen.getByText('Empty commercial land')).toBeInTheDocument();
  });

  it('says so when the listing is gone, and points to the search', async () => {
    features = [];
    show('/l/plumber/9');
    expect(await screen.findByText('This listing is not available')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse listings' })).toHaveAttribute('href', '/search');
  });

  it('an unknown type never asks the server', async () => {
    show('/l/nope/1');
    expect(await screen.findByText('This listing is not available')).toBeInTheDocument();
    expect(batchBodies).toHaveLength(0);
  });
});

describe('listing links', () => {
  it('builds /l/<type>/<id> and a WhatsApp message with the title and the link', () => {
    expect(listingPath({ kind: 'service', discriminator: 'plumber' }, '7')).toBe('/l/plumber/7');
    expect(whatsappShareLink('Plumber in Nablus', 'https://x.ps/l/plumber/7')).toBe(
      'https://wa.me/?text=Plumber%20in%20Nablus%0Ahttps%3A%2F%2Fx.ps%2Fl%2Fplumber%2F7',
    );
  });
});

describe('the share button', () => {
  it('without a share sheet: one button opening WhatsApp with the message, or copy link', async () => {
    const { default: ShareListingButton } = await import('./ShareListingButton');
    render(<ShareListingButton title="Plumber" url="https://x.ps/l/plumber/7" />);
    const share = screen.getByRole('button', { name: 'Share' });
    expect(share).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Share on WhatsApp' })).toBeNull();
    await userEvent.click(share);
    expect(share).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Share on WhatsApp' })).toHaveAttribute(
      'href',
      whatsappShareLink('Plumber', 'https://x.ps/l/plumber/7'),
    );
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('with a share sheet: one button that opens it', async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, share });
    const { default: ShareListingButton } = await import('./ShareListingButton');
    render(<ShareListingButton title="Plumber" url="https://x.ps/l/plumber/7" />);
    screen.getByRole('button', { name: 'Share' }).click();
    expect(share).toHaveBeenCalledWith({ title: 'Plumber', url: 'https://x.ps/l/plumber/7' });
    expect(screen.queryByRole('link', { name: 'Share on WhatsApp' })).toBeNull();
  });
});

describe('listing page helpers', () => {
  it('price per metre only when both price and area are known', () => {
    expect(pricePerMeter({ price: 900000, area: 632 })).toBe(1424);
    expect(pricePerMeter({ price: 900000, area: 0 })).toBeNull();
    expect(pricePerMeter({ price: '', area: 100 })).toBeNull();
  });

  it('similar listings: nearest first, never the listing itself', () => {
    const at = (key: string, x: number) =>
      ({ key, center: [x, 0], geometry: new Point([x, 0]) }) as unknown as SearchResult;
    const self = at('a', 0);
    const out = closestOthers([at('far', 900), self, at('near', 10), at('mid', 100)], self, 2);
    expect(out.map((r) => r.key)).toEqual(['near', 'mid']);
    expect(out[0].distance).toBe(10);
  });
});

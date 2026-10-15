import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import i18n from '@/i18n';
import ListingPage from './ListingPage';
import { listingPath, whatsappShareLink } from './link';

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
    expect(await screen.findByRole('heading', { level: 1, name: 'Flat for rent in Ramallah' })).toBeInTheDocument();
    expect(batchBodies[0]).toMatchObject({ workspace: 'realestate', ids: ['42'] });
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
  it('without a share sheet: WhatsApp with the message, and copy link', async () => {
    const { default: ShareListingButton } = await import('./ShareListingButton');
    render(<ShareListingButton title="Plumber" url="https://x.ps/l/plumber/7" />);
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

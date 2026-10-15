import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import i18n from '@/i18n';
import SaveListingButton from './SaveListingButton';
import SavedListings from './SavedListings';
import { SAVED_MAX, useSavedListings } from './savedStore';

const STORAGE_KEY = 'psm-saved-listings';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});
afterAll(async () => {
  await i18n.changeLanguage('ar');
});
beforeEach(() => {
  localStorage.clear();
  useSavedListings.setState({ items: [] });
});
afterEach(() => vi.unstubAllGlobals());

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

describe('saved listings', () => {
  it('the heart saves and unsaves, and the list is kept on the device', async () => {
    wrap(<SaveListingButton target={{ kind: 'service', discriminator: 'plumber' }} id="7" overlay />);
    const heart = screen.getByRole('button', { name: 'Save' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(heart);
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject([{ key: 'plumber', id: '7' }]);
    await userEvent.click(heart);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
  });

  it(`keeps at most ${SAVED_MAX}, newest first`, () => {
    for (let i = 0; i <= SAVED_MAX; i++) useSavedListings.getState().toggle('plumber', String(i));
    const { items } = useSavedListings.getState();
    expect(items).toHaveLength(SAVED_MAX);
    expect(items[0].id).toBe(String(SAVED_MAX));
  });

  it('the row is not there while nothing is saved', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { container } = wrap(<SavedListings />);
    expect(container).toBeEmptyDOMElement();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads the saved ones fresh, one request per type, and forgets the ones that are gone', async () => {
    useSavedListings.setState({
      items: [
        { key: 'rent', id: '19', savedAt: 2 },
        { key: 'rent', id: '20', savedAt: 1 },
      ],
    });
    const bodies: unknown[] = [];
    // jsdom has no ResizeObserver (the scroll rows watch their width for the arrows).
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (new URL(String(input), 'http://x').pathname === '/api/search-features-batch') {
          bodies.push(JSON.parse(String(init?.body)));
          return Promise.resolve(
            Response.json({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [1, 2] },
                  properties: { id: 19, location: 'Ramallah' },
                },
              ],
            }),
          );
        }
        return Promise.resolve(Response.json({}));
      }),
    );
    wrap(<SavedListings />);
    expect(await screen.findByRole('heading', { name: 'Saved' })).toBeInTheDocument();
    expect(screen.getByText('Flat for rent in Ramallah')).toBeInTheDocument();
    expect(bodies[0]).toEqual({ layer: 'ApartRent', workspace: 'realestate', ids: ['19', '20'] });
    await waitFor(() => expect(useSavedListings.getState().items.map((i) => i.id)).toEqual(['19']));
  });
});

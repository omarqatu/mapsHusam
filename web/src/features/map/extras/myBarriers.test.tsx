import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n';
import { useToastStore } from '@/components/ui/toastStore';
import MyBarriersWatcher from './MyBarriersWatcher';
import { changedBarriers, useMyBarriers } from './myBarriers';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});
afterAll(async () => {
  await i18n.changeLanguage('ar');
});
afterEach(() => {
  vi.unstubAllGlobals();
  useMyBarriers.setState({ ids: [] });
  useToastStore.setState({ items: [] });
});

describe('my checkpoints', () => {
  it('a change is news only for a starred checkpoint seen before', () => {
    const before = new Map([
      ['1', 'open|open'],
      ['2', 'open|'],
    ]);
    const now = new Map([
      ['1', 'closed|open'],
      ['2', 'closed|'],
      ['3', 'open|'],
    ]);
    expect(changedBarriers(null, now, ['1'])).toEqual([]);
    expect(changedBarriers(before, now, ['1', '3'])).toEqual(['1']);
  });

  it('tells the user when a starred checkpoint changes while the app is open', async () => {
    let stop = 0;
    const fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [1, 2] },
              properties: { id: 1, discriminator: 'road_barriers', name: 'Atara', stop, stop2: 0 },
            },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    useMyBarriers.setState({ ids: ['1'] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MyBarriersWatcher />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await waitFor(() => expect(client.getQueryData(['status-rows', 'road_barriers'])).toBeTruthy());
    expect(useToastStore.getState().items).toHaveLength(0); // the first read is the baseline
    stop = 1;
    await client.refetchQueries({ queryKey: ['status-rows', 'road_barriers'] });
    await waitFor(() => expect(useToastStore.getState().items).toHaveLength(1));
    expect(useToastStore.getState().items[0].message).toMatch(/^Atara: Inbound: Closed · Outbound: Open$/);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import '@/i18n';
import NoResultsNext from './NoResultsNext';

// A search that found nothing offers the next step instead of a dead end.

function renderIt(props: { term?: string; fromMap?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NoResultsNext {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));

describe('NoResultsNext', () => {
  beforeEach(() => {
    // No counts from the server: the fallback popular types are offered.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('offers popular types and adding a business, not the full search, on the search page', () => {
    renderIt();
    expect(hrefs()).toEqual(expect.arrayContaining(['/search?type=rent', '/search?type=sale', '/add-listing']));
    expect(screen.getByRole('link', { name: /أضف نشاطك/ })).toHaveAttribute('href', '/add-listing');
    expect(screen.queryByRole('link', { name: 'بحث بدون خريطة' })).toBeNull();
  });

  it('from the map, also links the same words to the search page', () => {
    renderIt({ term: 'شقة مفروشة', fromMap: true });
    expect(screen.getByRole('link', { name: 'بحث بدون خريطة' })).toHaveAttribute(
      'href',
      `/search?q=${encodeURIComponent('شقة مفروشة')}`,
    );
  });
});

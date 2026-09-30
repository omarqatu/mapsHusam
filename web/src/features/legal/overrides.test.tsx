import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import '@/i18n';
import LegalPage from './LegalPage';
import { parseOverride, serializeOverride } from './overrides';

function page(respond: (url: string) => Response) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => respond(String(url))));
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/legal/about']}>
        <Routes>
          <Route path="/legal/:key" element={<LegalPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('admin replacements of the legal texts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the replacement instead of the built-in text, through the allow-list', async () => {
    const value = serializeOverride({ title: 'عنّا', html: '<h3>مرحباً</h3><p>نص <b>جديد</b></p><script>alert(1)</script>' });
    page((url) =>
      url.endsWith('/api/platform-content/legal.about')
        ? new Response(JSON.stringify({ success: true, item: { content_key: 'legal.about', content_value: value } }))
        : new Response(JSON.stringify({ success: true, item: null })),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'عنّا' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'مرحباً' })).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('no replacement (item: null) → the built-in text', async () => {
    page(() => new Response(JSON.stringify({ success: true, item: null })));
    expect(await screen.findByRole('heading', { level: 1, name: /من نحن/ })).toBeInTheDocument();
  });

  it('an unreadable stored value counts as no replacement', () => {
    for (const raw of [null, '', 'x', '{}', '{"html":"  "}', '[]']) expect(parseOverride(raw)).toBeNull();
    expect(parseOverride('{"html":"<p>a</p>"}')).toEqual({ title: '', html: '<p>a</p>' });
  });
});

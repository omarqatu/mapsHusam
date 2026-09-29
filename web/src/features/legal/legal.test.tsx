import { beforeAll, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import '@/i18n';
import LegalDocView from './LegalDocView';
import LegalLinks from './LegalLinks';
import LegalPage from './LegalPage';
import { LEGAL_KEYS, loadLegalDoc } from './content';
import type { LegalDoc, LegalKey } from './types';

const keys = LEGAL_KEYS;
const legalContent = {} as Record<LegalKey, LegalDoc>;
beforeAll(async () => {
  for (const k of keys) legalContent[k] = await loadLegalDoc(k);
});

const withQuery = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {ui}
  </QueryClientProvider>
);

describe('legal content', () => {
  it('every LegalKey has a text file and vice versa', () => {
    expect([...keys].sort()).toEqual([
      'about',
      'contact',
      'guide',
      'guideMapInteractive',
      'guideProvider',
      'guideSearch',
      'guideSubscription',
      'privacy',
      'terms',
    ]);
  });

  it.each(keys)('%s renders as plain JSX text (no markup leaks)', (key) => {
    const { container } = render(
      <MemoryRouter>
        <LegalDocView doc={legalContent[key]} />
      </MemoryRouter>,
    );
    expect(container.textContent!.length).toBeGreaterThan(50);
    expect(container.textContent).not.toMatch(/<\/?[a-z][^>]*>/i);
    // every external link opens safely
    container.querySelectorAll('a[href^="http"]').forEach((a) => {
      expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });
  });

  it('has no leftover legacy page links', () => {
    expect(JSON.stringify(legalContent)).not.toMatch(/\.html/);
  });

  it('/legal/:key shows the document and /legal/unknown is a 404', async () => {
    const at = (path: string) =>
      render(
        withQuery(
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/legal/:key" element={<LegalPage />} />
            </Routes>
          </MemoryRouter>,
        ),
      );
    const { unmount } = at('/legal/terms');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(legalContent.terms.title);
    unmount();
    at('/legal/__proto__');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('LegalLinks opens a text in a dialog and Escape closes it', async () => {
    render(
      withQuery(
        <MemoryRouter>
          <LegalLinks keys={['privacy']} />
        </MemoryRouter>,
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: /سياسة الخصوصية|Privacy policy/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(legalContent.privacy.title);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

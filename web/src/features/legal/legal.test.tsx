import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import '@/i18n';
import LegalDocView from './LegalDocView';
import LegalLinks from './LegalLinks';
import LegalPage from './LegalPage';
import { legalContent } from './content';
import type { LegalKey } from './types';

const keys = Object.keys(legalContent) as LegalKey[];

describe('legal content', () => {
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

  it('/legal/:key shows the document and /legal/unknown is a 404', () => {
    const at = (path: string) =>
      render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/legal/:key" element={<LegalPage />} />
          </Routes>
        </MemoryRouter>,
      );
    const { unmount } = at('/legal/terms');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(legalContent.terms.title);
    unmount();
    at('/legal/__proto__');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('LegalLinks opens a text in a dialog and Escape closes it', async () => {
    render(
      <MemoryRouter>
        <LegalLinks keys={['privacy']} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /سياسة الخصوصية|Privacy policy/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent(legalContent.privacy.title);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

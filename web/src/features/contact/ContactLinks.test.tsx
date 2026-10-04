import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import '@/i18n';
import { InfoList } from '@/components/InfoMenu';
import SiteFooter from '@/components/SiteFooter';
import { CONTACT_KEY, serializeContact } from './model';

/** The server's answer for the contact setting (null = nobody saved numbers); the legal texts ask for replacements too. */
function stubContact(value: string | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const isContact = String(url).endsWith(encodeURIComponent(CONTACT_KEY));
      const item = isContact && value !== null ? { content_key: CONTACT_KEY, label: 'x', content_value: value, updated_at: '' } : null;
      return new Response(JSON.stringify({ success: true, item }));
    }),
  );
}

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('the platform contact buttons', () => {
  it('the footer shows WhatsApp and phone links once the admin set the numbers', async () => {
    stubContact(serializeContact({ whatsapp: '0599123456', phone: '022345678' }));
    renderWith(<SiteFooter />);
    const wa = await screen.findByRole('link', { name: 'واتساب' });
    expect(wa.getAttribute('href')).toContain('https://wa.me/970599123456?text=');
    expect(screen.getByRole('link', { name: 'اتصل بنا' }).getAttribute('href')).toBe('tel:022345678');
  });

  it('shows no contact button while no number is set (and a number left empty hides only its own button)', async () => {
    stubContact(null);
    renderWith(<SiteFooter />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'واتساب' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'اتصل بنا' })).toBeNull();
  });

  it('the information menu lists them too, only the one that is set', async () => {
    stubContact(serializeContact({ whatsapp: '', phone: '022345678' }));
    renderWith(<InfoList onPick={() => {}} />);
    expect((await screen.findByRole('link', { name: 'اتصل بنا' })).getAttribute('href')).toBe('tel:022345678');
    expect(screen.queryByRole('link', { name: 'تواصل معنا عبر واتساب' })).toBeNull();
  });
});

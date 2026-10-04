import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import '@/i18n';
import { useAuthStore } from '@/store/authStore';
import RegisterPage from './RegisterPage';

// OpenLayers needs a canvas; the location picker is replaced by one button that taps a fixed point.
vi.mock('@/features/listing-submissions/LocationPicker', () => ({
  default: ({ onChange }: { onChange: (p: [number, number]) => void }) => (
    <button type="button" onClick={() => onChange([169463.41234, 145767.99876])}>
      pick-location
    </button>
  ),
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/home" element={<div>home page</div>} />
          <Route path="/add-listing" element={<div>add listing page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * `fetch` for the page: the legal texts ask the server for an admin replacement (answered "none"); everything else is the
 * one response under test; the login that follows a registration gets `loginResponse` (default: signed in).
 * `registerCalls` are the requests to /api/auth/register only.
 */
const SIGNED_IN = { user: { user_id: 7, full_name: 'Sara', phone: '0598512667', role: 'user', token: 't' } };
function stubFetch(
  registerResponse: Response,
  loginResponse = new Response(JSON.stringify(SIGNED_IN)),
) {
  const registerCalls: [string, RequestInit][] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (String(url).startsWith('/api/platform-content/'))
        return new Response(JSON.stringify({ success: true, item: null }));
      if (url === '/api/listing-submissions/layers')
        return new Response(JSON.stringify({ success: true, layers: ['plumber', 'hotels'] }));
      if (url === '/api/auth/login') return loginResponse.clone();
      registerCalls.push([url, init]);
      return registerResponse.clone();
    }),
  );
  return registerCalls;
}

const CONTINUE = /التسجيل عبر رقم واتساب|Register with a WhatsApp number/;

async function passTerms() {
  await userEvent.click(screen.getAllByRole('checkbox')[0]);
  await userEvent.click(screen.getAllByRole('checkbox')[1]);
  await userEvent.click(screen.getByRole('button', { name: CONTINUE }));
}

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('writes the full privacy policy and terms in a box before the tick boxes; an admin replacement wins', async () => {
    const custom = JSON.stringify({
      title: 'شروطنا المعدّلة',
      html: '<p>نص من المشرف</p><script>alert(1)</script>',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).endsWith('/api/platform-content/legal.terms')
          ? new Response(
              JSON.stringify({ success: true, item: { content_key: 'legal.terms', content_value: custom } }),
            )
          : new Response(JSON.stringify({ success: true, item: null })),
      ),
    );
    setup();
    const box = await screen.findByRole('region', {
      name: /سياسة الخصوصية وشروط الاستخدام كاملة|full privacy policy/,
    });
    expect(await screen.findByText('نص من المشرف')).toBeInTheDocument(); // the replaced terms
    expect(await screen.findByRole('heading', { name: 'شروطنا المعدّلة' })).toBeInTheDocument();
    expect(box.textContent).toMatch(/الخصوصية/); // the built-in privacy policy is there too
    expect(document.querySelector('script')).toBeNull();
    expect(box).toHaveAttribute('tabindex', '0'); // scrollable by keyboard
  });

  it('keeps the form locked until both the terms and the Facebook box are ticked', async () => {
    setup();
    const go = screen.getByRole('button', { name: CONTINUE });
    expect(go).toBeDisabled();
    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(go).toBeDisabled();
    await userEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(go).toBeEnabled();
  });

  it('sends the WhatsApp number built from prefix + local number, then is signed in at once', async () => {
    const calls = stubFetch(
      new Response(JSON.stringify({ status: 'success', message: 'ok', user: {} }), { status: 201 }),
    );
    setup();
    await passTerms();
    await userEvent.type(screen.getByLabelText(/الاسم الكامل|Full name/), 'Sara');
    await userEvent.type(screen.getByLabelText(/رقم الموبايل المحلي|Local mobile number/), '0598512667');
    await userEvent.type(screen.getByLabelText(/كلمة المرور|Password/), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: /إتمام التسجيل|Complete registration/ }));
    await waitFor(() => expect(screen.getByText('home page')).toBeInTheDocument());
    const [url, init] = calls[0];
    expect(url).toBe('/api/auth/register');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Sara',
      phone: '0598512667',
      whatsapp_number: '+970598512667',
      password: 'secret1',
      email: '',
    });
    expect(useAuthStore.getState().user).toMatchObject({ user_id: 7, role: 'user' });
  });

  it('goes to the login page when the account cannot log in right away', async () => {
    stubFetch(
      new Response(JSON.stringify({ status: 'success', message: 'ok', user: {} }), { status: 201 }),
      new Response(JSON.stringify({ message: 'معطل' }), { status: 403 }),
    );
    setup();
    await passTerms();
    await userEvent.type(screen.getByLabelText(/الاسم الكامل|Full name/), 'Sara');
    await userEvent.type(screen.getByLabelText(/رقم الموبايل المحلي|Local mobile number/), '0598512667');
    await userEvent.type(screen.getByLabelText(/كلمة المرور|Password/), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: /إتمام التسجيل|Complete registration/ }));
    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('validates the mobile number and password locally and shows the server error otherwise', async () => {
    const calls = stubFetch(
      new Response(JSON.stringify({ error: 'رقم الجوال هذا مستخدم بالفعل' }), { status: 400 }),
    );
    setup();
    await passTerms();
    await userEvent.type(screen.getByLabelText(/الاسم الكامل|Full name/), 'Sara');
    await userEvent.type(screen.getByLabelText(/رقم الموبايل المحلي|Local mobile number/), '123');
    await userEvent.type(screen.getByLabelText(/كلمة المرور|Password/), '12');
    await userEvent.click(screen.getByRole('button', { name: /إتمام التسجيل|Complete registration/ }));
    expect(calls).toHaveLength(0); // nothing is sent until the local checks pass
    expect(screen.getAllByRole('alert')).toHaveLength(2);

    await userEvent.clear(screen.getByLabelText(/رقم الموبايل المحلي|Local mobile number/));
    await userEvent.type(screen.getByLabelText(/رقم الموبايل المحلي|Local mobile number/), '0598512667');
    await userEvent.type(screen.getByLabelText(/كلمة المرور|Password/), '3456');
    await userEvent.click(screen.getByRole('button', { name: /إتمام التسجيل|Complete registration/ }));
    expect(await screen.findByText('رقم الجوال هذا مستخدم بالفعل')).toBeInTheDocument();
  });

  it('sends a business with the account when the box is ticked; the business number defaults to the account number', async () => {
    const calls = stubFetch(
      new Response(JSON.stringify({ status: 'success', message: 'ok', user: {} }), { status: 201 }),
    );
    setup();
    await passTerms();
    await userEvent.type(screen.getByLabelText(/الاسم الكامل|Full name/), 'Sara');
    await userEvent.type(screen.getByLabelText(/رقم الموبايل المحلي|Local mobile number/), '0598512667');
    await userEvent.type(screen.getByLabelText(/كلمة المرور|Password/), 'secret1');
    await userEvent.click(screen.getByRole('checkbox', { name: /عندي نشاط تجاري|I have a business/ }));

    // Nothing is sent while the business part is incomplete.
    await userEvent.click(screen.getByRole('button', { name: /إتمام التسجيل|Complete registration/ }));
    expect(calls).toHaveLength(0);

    await userEvent.click(await screen.findByRole('combobox', { name: /نوع النشاط|Type of business/ }));
    await userEvent.click(await screen.findByRole('option', { name: /سباك|Plumber/i }));
    await userEvent.type(screen.getByLabelText(/اسم النشاط|Business name/), 'سباكة الأمل');
    await userEvent.click(screen.getByRole('button', { name: 'pick-location' }));
    await userEvent.click(screen.getByRole('button', { name: /إتمام التسجيل|Complete registration/ }));

    await waitFor(() => expect(screen.getByText('add listing page')).toBeInTheDocument());
    expect(JSON.parse(calls[0][1].body as string)).toMatchObject({
      phone: '0598512667',
      listing: {
        layer: 'plumber',
        name: 'سباكة الأمل',
        phone: '0598512667',
        whatsapp: '+970598512667',
        x_coord: 169463.412,
        y_coord: 145767.999,
      },
    });
  });
});

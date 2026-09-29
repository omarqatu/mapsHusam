import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import '@/i18n';
import { useAuthStore } from '@/store/authStore';
import RegisterPage from './RegisterPage';

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
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

  it('keeps the form locked until both the terms and the Facebook box are ticked', async () => {
    setup();
    const go = screen.getByRole('button', { name: CONTINUE });
    expect(go).toBeDisabled();
    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(go).toBeDisabled();
    await userEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(go).toBeEnabled();
  });

  it('sends the WhatsApp number built from prefix + local number and goes to login on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'success', message: 'ok', user: {} }), { status: 201 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    setup();
    await passTerms();
    await userEvent.type(screen.getByLabelText(/الاسم الكامل|Full name/), 'Sara');
    await userEvent.type(screen.getByLabelText(/رقم الموبايل المحلي|Local mobile number/), '0598512667');
    await userEvent.type(screen.getByLabelText(/كلمة المرور|Password/), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: /إتمام التسجيل|Complete registration/ }));
    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/register');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Sara',
      phone: '0598512667',
      whatsapp_number: '+970598512667',
      password: 'secret1',
      email: '',
    });
    expect(useAuthStore.getState().user).toBeNull(); // registering does not log in
  });

  it('validates the mobile number and password locally and shows the server error otherwise', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'رقم الجوال هذا مستخدم بالفعل' }), { status: 400 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    setup();
    await passTerms();
    await userEvent.type(screen.getByLabelText(/الاسم الكامل|Full name/), 'Sara');
    await userEvent.type(screen.getByLabelText(/رقم الموبايل المحلي|Local mobile number/), '123');
    await userEvent.type(screen.getByLabelText(/كلمة المرور|Password/), '12');
    await userEvent.click(screen.getByRole('button', { name: /إتمام التسجيل|Complete registration/ }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert')).toHaveLength(2);

    await userEvent.clear(screen.getByLabelText(/رقم الموبايل المحلي|Local mobile number/));
    await userEvent.type(screen.getByLabelText(/رقم الموبايل المحلي|Local mobile number/), '0598512667');
    await userEvent.type(screen.getByLabelText(/كلمة المرور|Password/), '3456');
    await userEvent.click(screen.getByRole('button', { name: /إتمام التسجيل|Complete registration/ }));
    expect(await screen.findByText('رقم الجوال هذا مستخدم بالفعل')).toBeInTheDocument();
  });
});

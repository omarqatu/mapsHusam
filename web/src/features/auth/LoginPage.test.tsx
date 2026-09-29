import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import '@/i18n';
import { useAuthStore } from '@/store/authStore';
import LoginPage from './LoginPage';

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the server message on wrong credentials and stays on the page', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: 'رقم الجوال أو كلمة المرور غير صحيحة.' }), { status: 401 }),
        ),
    );
    setup();
    await userEvent.type(screen.getByLabelText(/رقم الجوال|Phone/), '0590000001');
    await userEvent.type(screen.getByLabelText(/كلمة المرور|Password/), 'bad');
    await userEvent.click(screen.getByRole('button', { name: /تسجيل الدخول|Log in/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('رقم الجوال أو كلمة المرور غير صحيحة.');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('stores the session and leaves /login on success', async () => {
    const user = { user_id: 1, role: 'user', token: 'tk', phone: '0590000003', admin_token: null };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'ok', user }), { status: 200 })),
    );
    setup();
    await userEvent.type(screen.getByLabelText(/رقم الجوال|Phone/), '0590000003');
    await userEvent.type(screen.getByLabelText(/كلمة المرور|Password/), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /تسجيل الدخول|Log in/ }));
    await waitFor(() => expect(screen.getByText('home')).toBeInTheDocument());
    expect(useAuthStore.getState().user?.token).toBe('tk');
  });
});

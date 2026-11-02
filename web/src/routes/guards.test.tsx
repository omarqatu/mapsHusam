import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import '@/i18n';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';
import { ProtectedRoute, RoleRoute } from './guards';

const mk = (role: AuthUser['role']) => ({ user_id: 1, role, token: 't', phone: '1' }) as AuthUser;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/welcome" element={<div>welcome page</div>} />
        <Route element={<ProtectedRoute to="/welcome" allowGuest />}>
          <Route path="/map" element={<div>map</div>} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/inbox" element={<div>inbox</div>} />
        </Route>
        <Route element={<RoleRoute roles={['admin']} />}>
          <Route path="/admin" element={<div>admin area</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('route guards', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
    localStorage.removeItem('guest_mode');
  });

  it('a guest or a shared link opens the home page, never the account pages', () => {
    localStorage.setItem('guest_mode', 'true');
    const { unmount } = renderAt('/map');
    expect(screen.getByText('map')).toBeInTheDocument();
    unmount();
    const second = renderAt('/inbox');
    expect(screen.getByText('login page')).toBeInTheDocument();
    second.unmount();
    localStorage.removeItem('guest_mode');
    renderAt('/inbox?x=1&y=1');
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('sends anonymous visitors to /login', () => {
    renderAt('/inbox');
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('can send them somewhere else, e.g. the welcome page for the home page', () => {
    renderAt('/map');
    expect(screen.getByText('welcome page')).toBeInTheDocument();
  });

  it('lets a logged-in user through ProtectedRoute', () => {
    useAuthStore.setState({ user: mk('user') });
    renderAt('/inbox');
    expect(screen.getByText('inbox')).toBeInTheDocument();
  });

  it('blocks a non-admin from an admin route and allows an admin', () => {
    useAuthStore.setState({ user: mk('provider') });
    const { unmount } = renderAt('/admin');
    expect(screen.queryByText('admin area')).not.toBeInTheDocument();
    unmount();
    useAuthStore.setState({ user: mk('admin') });
    renderAt('/admin');
    expect(screen.getByText('admin area')).toBeInTheDocument();
  });
});

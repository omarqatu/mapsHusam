import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/types/auth';
import ForbiddenPage from './ForbiddenPage';
import { hasDirectAccessParams, isGuestMode } from './access';

/**
 * Any logged-in user; otherwise → `to` (default /login) and back afterwards. `allowGuest` (only the home page and
 * /search) also lets in a visitor who chose "browse as guest" or opened a shared location / results link: those pages
 * work without an account. The account pages (profile, my listings, notifications…) never do.
 */
export function ProtectedRoute({ to = '/login', allowGuest = false }: { to?: string; allowGuest?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (user) return <Outlet />;
  if (allowGuest && (isGuestMode() || hasDirectAccessParams(new URLSearchParams(location.search)))) return <Outlet />;
  return <Navigate to={to} replace state={{ from: location.pathname + location.search }} />;
}

/** Logged in AND one of `roles`. UX only — every endpoint re-checks on the server. */
export function RoleRoute({ roles }: { roles: Role[] }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(user.role)) return <ForbiddenPage />;
  return <Outlet />;
}

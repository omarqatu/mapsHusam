import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/types/auth';
import ForbiddenPage from './ForbiddenPage';

/** Any logged-in user; otherwise → `to` (default /login) and back afterwards. The home page sends visitors to /welcome. */
export function ProtectedRoute({ to = '/login' }: { to?: string }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to={to} replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Logged in AND one of `roles`. UX only — every endpoint re-checks on the server. */
export function RoleRoute({ roles }: { roles: Role[] }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(user.role)) return <ForbiddenPage />;
  return <Outlet />;
}

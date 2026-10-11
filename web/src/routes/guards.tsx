import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/types/auth';
import ForbiddenPage from './ForbiddenPage';

/** Check if URL has specific parameters that should bypass the welcome page (shared locations, results, etc.) */
function hasDirectAccessParams(searchParams: URLSearchParams): boolean {
  return (
    searchParams.has('x') && searchParams.has('y') ||
    searchParams.has('resultsShare')
  );
}

/** Any logged-in user; otherwise → `to` (default /login) and back afterwards. The home page sends visitors to /welcome. */
export function ProtectedRoute({ to = '/login' }: { to?: string }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  // Check if guest mode (user clicked "Enter as guest" button - stored in localStorage)
  const isGuest = typeof window !== 'undefined' && localStorage.getItem('guest_mode') === 'true';

  // If not logged in and URL has direct access params (shared location/results), allow access
  if (!user && hasDirectAccessParams(searchParams)) {
    return <Outlet />;
  }

  // If not logged in and guest mode, allow access
  if (!user && isGuest) {
    return <Outlet />;
  }

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

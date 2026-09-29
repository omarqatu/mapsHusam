import { lazy, Suspense, type ReactElement } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import SocketConnector from '@/api/SocketConnector';
import AppShell from '@/components/AppShell';
import ErrorBoundary from '@/components/ErrorBoundary';
import SessionVerifier from '@/components/SessionVerifier';
import AuthLayout from '@/features/auth/AuthLayout';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import WelcomePage from '@/features/auth/WelcomePage';
import RequestsHost from '@/features/requests/RequestsHost';
import { ProtectedRoute, RoleRoute } from '@/routes/guards';
import NotFoundPage from '@/routes/NotFoundPage';
import PlaceholderPage from '@/routes/PlaceholderPage';
import { appRoutes, type AppRoute } from '@/routes/routes';
import { CenteredSpinner } from '@/components/ui/Spinner';

// One chunk per page: a visitor on the login screen downloads neither OpenLayers nor the admin and search code.
const MapPage = lazy(() => import('@/features/map/MapPage'));
const AdminDashboardPage = lazy(() => import('@/features/admin-dashboard/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('@/features/admin-users/AdminUsersPage'));
const AdminViewUserPage = lazy(() => import('@/features/admin-users/AdminViewUserPage'));
const AdminWidgetsPage = lazy(() => import('@/features/admin-widgets/AdminWidgetsPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const SearchPage = lazy(() => import('@/features/search/SearchPage'));
const WidgetsPortalPage = lazy(() => import('@/features/widgets/WidgetsPortalPage'));
const WidgetsTickerPage = lazy(() => import('@/features/widgets/WidgetsTickerPage'));
const LegalPage = lazy(() => import('@/features/legal/LegalPage'));

// Ported pages by path; everything else still shows its placeholder.
const ported: Record<string, ReactElement> = {
  '/notifications': <NotificationsPage />,
  '/search': <SearchPage />,
  '/widgets/portal': <WidgetsPortalPage />,
  '/widgets/ticker': <WidgetsTickerPage />,
  '/admin/users': <AdminUsersPage />,
  '/admin/users/:id/view': <AdminViewUserPage />,
  '/admin/dashboard': <AdminDashboardPage />,
  '/admin/widgets': <AdminWidgetsPage />,
};

const page = (r: AppRoute) => ({ path: r.path, element: ported[r.path] ?? <PlaceholderPage route={r} /> });

const shelled = appRoutes.filter((r) => !r.own);

const router = createBrowserRouter([
  // Full-screen pages with their own layout. Same access as legacy: the map needs a login.
  {
    element: <ProtectedRoute to="/welcome" />, // like legacy: a visitor sees the welcome page (log in / register), not a bare form
    children: [
      {
        path: '/',
        element: (
          <Suspense fallback={<CenteredSpinner minHeight="100vh" />}>
            <MapPage />
          </Suspense>
        ),
      },
    ],
  },
  // Pre-login screens (legacy promo splash + auth overlay) and the legal texts.
  {
    element: <AuthLayout />,
    children: [
      { path: '/welcome', element: <WelcomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/legal/:key', element: <LegalPage /> },
    ],
  },
  {
    element: <AppShell />,
    children: [
      ...shelled.filter((r) => r.access === 'public').map(page),
      { element: <ProtectedRoute />, children: shelled.filter((r) => r.access === 'auth').map(page) },
      {
        element: <RoleRoute roles={['admin']} />,
        children: appRoutes.filter((r) => Array.isArray(r.access) && r.access.join() === 'admin').map(page),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SocketConnector />
        <SessionVerifier />
        <RequestsHost />
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

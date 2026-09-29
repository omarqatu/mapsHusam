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
import NotificationsPage from '@/features/notifications/NotificationsPage';
import RequestsHost from '@/features/requests/RequestsHost';
import LegalPage from '@/features/legal/LegalPage';
import { ProtectedRoute, RoleRoute } from '@/routes/guards';
import NotFoundPage from '@/routes/NotFoundPage';
import PlaceholderPage from '@/routes/PlaceholderPage';
import { appRoutes, type AppRoute } from '@/routes/routes';
import { CenteredSpinner } from '@/components/ui/Spinner';

// OpenLayers is most of the bundle; only the map page needs it.
const MapPage = lazy(() => import('@/features/map/MapPage'));

// Ported pages by path; everything else still shows its placeholder.
const ported: Record<string, ReactElement> = { '/notifications': <NotificationsPage /> };

const page = (r: AppRoute) => ({ path: r.path, element: ported[r.path] ?? <PlaceholderPage route={r} /> });

const shelled = appRoutes.filter((r) => !r.own);

const router = createBrowserRouter([
  // Full-screen pages with their own layout. Same access as legacy: the map needs a login.
  {
    element: <ProtectedRoute />,
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

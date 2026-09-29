import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import SocketConnector from '@/api/SocketConnector';
import AppShell from '@/components/AppShell';
import ErrorBoundary from '@/components/ErrorBoundary';
import SessionVerifier from '@/components/SessionVerifier';
import LoginPage from '@/features/auth/LoginPage';
import { ProtectedRoute, RoleRoute } from '@/routes/guards';
import NotFoundPage from '@/routes/NotFoundPage';
import PlaceholderPage from '@/routes/PlaceholderPage';
import { appRoutes, type AppRoute } from '@/routes/routes';
import { CenteredSpinner } from '@/components/ui/Spinner';

// OpenLayers is most of the bundle; only the map page needs it.
const MapPage = lazy(() => import('@/features/map/MapPage'));

const page = (r: AppRoute) => ({ path: r.path, element: <PlaceholderPage route={r} /> });

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
  {
    element: <AppShell />,
    children: [
      { path: '/login', element: <LoginPage /> },
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
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

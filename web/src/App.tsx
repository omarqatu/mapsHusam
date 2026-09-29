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

const page = (r: AppRoute) => ({ path: r.path, element: <PlaceholderPage route={r} /> });

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/login', element: <LoginPage /> },
      ...appRoutes.filter((r) => r.access === 'public').map(page),
      { element: <ProtectedRoute />, children: appRoutes.filter((r) => r.access === 'auth').map(page) },
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

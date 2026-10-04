import { lazy, Suspense, type ReactElement } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import SocketConnector from '@/api/SocketConnector';
import AppShell from '@/components/AppShell';
import ErrorBoundary from '@/components/ErrorBoundary';
import SessionVerifier from '@/components/SessionVerifier';
import { TextOverridesSync } from '@/features/text-overrides/store';
import { BrandThemeSync } from '@/features/brand-theme/store';
import { VisibilitySync } from '@/features/visibility/store';
import AuthLayout from '@/features/auth/AuthLayout';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import WelcomePage from '@/features/auth/WelcomePage';
import LoginPrompt from '@/features/auth/LoginPrompt';
import RequestsHost from '@/features/requests/RequestsHost';
import { ProtectedRoute, RoleRoute } from '@/routes/guards';
import NotFoundPage from '@/routes/NotFoundPage';
import PlaceholderPage from '@/routes/PlaceholderPage';
import { appRoutes, type AppRoute } from '@/routes/routes';
import { CenteredSpinner } from '@/components/ui/Spinner';

// One chunk per page: a visitor on the login screen downloads neither OpenLayers nor the admin and search code.
const HomePage = lazy(() => import('@/features/home/HomePage'));
const MapPage = lazy(() => import('@/features/map/MapPage'));
const AdminDashboardPage = lazy(() => import('@/features/admin-dashboard/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('@/features/admin-users/AdminUsersPage'));
const AdminViewUserPage = lazy(() => import('@/features/admin-users/AdminViewUserPage'));
const AdminWidgetsPage = lazy(() => import('@/features/admin-widgets/AdminWidgetsPage'));
const AdminVisibilityPage = lazy(() => import('@/features/admin-visibility/AdminVisibilityPage'));
const AdminSubmissionsPage = lazy(() => import('@/features/listing-submissions/AdminSubmissionsPage'));
const AddListingPage = lazy(() => import('@/features/listing-submissions/AddListingPage'));
const AdminTextsPage = lazy(() => import('@/features/admin-texts/AdminTextsPage'));
const AdminAppearancePage = lazy(() => import('@/features/brand-theme/AdminAppearancePage'));
const AdminContactPage = lazy(() => import('@/features/platform-contact/AdminContactPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const SearchPage = lazy(() => import('@/features/search/SearchPage'));
const WidgetsPortalPage = lazy(() => import('@/features/widgets/WidgetsPortalPage'));
const WidgetsTickerPage = lazy(() => import('@/features/widgets/WidgetsTickerPage'));
const LegalPage = lazy(() => import('@/features/legal/LegalPage'));

// Ported pages by path; everything else still shows its placeholder.
const ported: Record<string, ReactElement> = {
  '/home': <HomePage />,
  '/notifications': <NotificationsPage />,
  '/search': <SearchPage />,
  '/widgets/portal': <WidgetsPortalPage />,
  '/widgets/ticker': <WidgetsTickerPage />,
  '/admin/users': <AdminUsersPage />,
  '/admin/users/:id/view': <AdminViewUserPage />,
  '/admin/dashboard': <AdminDashboardPage />,
  '/admin/widgets': <AdminWidgetsPage />,
  '/admin/visibility': <AdminVisibilityPage />,
  '/admin/texts': <AdminTextsPage />,
  '/admin/appearance': <AdminAppearancePage />,
  '/admin/contact': <AdminContactPage />,
  '/admin/submissions': <AdminSubmissionsPage />,
  '/add-listing': <AddListingPage />,
};

const page = (r: AppRoute) => ({ path: r.path, element: ported[r.path] ?? <PlaceholderPage route={r} /> });

const shelled = appRoutes.filter((r) => !r.own);

const router = createBrowserRouter([
  // Everything under one root so app-wide sheets that navigate (LoginPrompt) live inside the router.
  {
    element: <RootLayout />,
    children: [
      // The map: full screen, its own layout, open to visitors (legacy needed a login; the data is public on GeoServer
      // anyway). Requests, chat and the provider panel still need a session.
      {
        path: '/',
        element: (
          <Suspense fallback={<CenteredSpinner minHeight="100vh" />}>
            <MapPage />
          </Suspense>
        ),
      },
      // The public welcome route is the full-screen legacy promo splash.
      { path: '/welcome', element: <WelcomePage /> },
      // Pre-login forms and the legal texts.
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/legal/:key', element: <LegalPage /> },
        ],
      },
      {
        element: <AppShell />,
        children: [
          ...shelled.filter((r) => r.access === 'public').map(page),
          // The landing page sends a visitor to /welcome (log in / register) rather than to a bare form.
          {
            element: <ProtectedRoute to="/welcome" />,
            children: shelled.filter((r) => r.path === '/home').map(page),
          },
          {
            element: <ProtectedRoute />,
            children: shelled.filter((r) => r.access === 'auth' && r.path !== '/home').map(page),
          },
          {
            element: <RoleRoute roles={['admin']} />,
            children: appRoutes
              .filter((r) => Array.isArray(r.access) && r.access.join() === 'admin')
              .map(page),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

function RootLayout() {
  return (
    <>
      <Outlet />
      <LoginPrompt />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SocketConnector />
        <SessionVerifier />
        <VisibilitySync />
        <TextOverridesSync />
        <BrandThemeSync />
        <RequestsHost />
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

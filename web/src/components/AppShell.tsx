import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { CenteredSpinner } from '@/components/ui/Spinner';
import Toaster from '@/components/ui/Toaster';
import AppHeader from './AppHeader';
import SiteFooter from './SiteFooter';

/** Frame of every regular page: the shared top bar, the page, the shared footer. (The map fills the screen and only reuses the bar.) */
export default function AppShell() {
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      {/* The loading spinner fills the screen so the footer never shows mid-page and then jumps down. */}
      <main className="mx-auto w-full max-w-7xl flex-1 p-4">
        <Suspense fallback={<CenteredSpinner minHeight="100vh" />}>
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}

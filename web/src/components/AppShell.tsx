import { Outlet } from 'react-router';
import Toaster from '@/components/ui/Toaster';
import AppHeader from './AppHeader';

/** Frame of every regular page: the shared top bar, then the page. (The map fills the screen and only reuses the bar.) */
export default function AppShell() {
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}

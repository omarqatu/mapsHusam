import { Suspense } from 'react';
import { Link, Outlet } from 'react-router';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { useTranslation } from 'react-i18next';
import { MapPinned } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Toaster from '@/components/ui/Toaster';
import LegalLinks from '@/features/legal/LegalLinks';

/** Shell for welcome / login / register / legal: brand + language only, no app navigation. */
export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-full flex-col bg-gradient-to-br from-brand/10 via-surface to-brand-2/10">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/welcome" className="flex items-center gap-2 text-lg font-black text-brand-fg">
          <MapPinned className="h-6 w-6" aria-hidden />
          {t('app.name')}
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-6">
        <Suspense fallback={<CenteredSpinner minHeight="30vh" />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-line bg-surface/70 px-4 py-3">
        <LegalLinks linkClassName="text-muted" />
      </footer>
      <Toaster />
    </div>
  );
}

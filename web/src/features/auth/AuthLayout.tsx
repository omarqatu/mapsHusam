import { Suspense } from 'react';
import { Link, Outlet } from 'react-router';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { useTranslation } from 'react-i18next';
import BrandMark from '@/components/BrandMark';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Toaster from '@/components/ui/Toaster';
import LegalLinks from '@/features/legal/LegalLinks';

/** Shell for welcome / login / register / legal: brand + language only, no app navigation. */
export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="brand-backdrop flex min-h-dvh flex-col text-fg">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <Link to="/welcome" className="flex items-center gap-2.5">
          <BrandMark className="h-10 w-10" />
          <span className="text-2xl font-black text-brand-fg">{t('app.shortName')}</span>
        </Link>
        <div className="rounded-xl border border-line bg-surface/80">
          <LanguageSwitcher />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-6 sm:py-10">
        <Suspense fallback={<CenteredSpinner minHeight="30vh" />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-line bg-surface/70 px-4 py-3">
        <LegalLinks linkClassName="text-muted hover:text-brand-fg" />
      </footer>
      <Toaster />
    </div>
  );
}

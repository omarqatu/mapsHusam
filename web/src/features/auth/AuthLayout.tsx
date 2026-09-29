import { Suspense } from 'react';
import { Link, Outlet } from 'react-router';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { useTranslation } from 'react-i18next';
import { MapPinned } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Toaster from '@/components/ui/Toaster';
import LegalLinks from '@/features/legal/LegalLinks';
import PromoSlideshow from './welcome/PromoSlideshow';

/** Shell for welcome / login / register / legal: brand + language only, no app navigation. */
export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#0a0a1a]">
      <PromoSlideshow />
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(3,8,20,0.82)_0%,rgba(4,12,25,0.68)_48%,rgba(3,8,20,0.88)_100%)]" />
      <header className="relative z-[3] border-b border-white/10 bg-black/15 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <Link to="/welcome" className="flex items-center gap-2 text-lg font-black text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4fc3f7] to-[#00e676] text-[#07131d] shadow-lg shadow-cyan-500/20">
            <MapPinned className="h-5 w-5" aria-hidden />
          </span>
          {t('app.name')}
        </Link>
          <div className="rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-md [&_button]:text-white">
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      <main className="relative z-[2] mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <Suspense fallback={<CenteredSpinner minHeight="30vh" />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="relative z-[2] border-t border-white/10 bg-black/20 px-4 py-3 backdrop-blur-lg">
        <LegalLinks linkClassName="text-white/75 hover:text-white" />
      </footer>
      <Toaster />
    </div>
  );
}

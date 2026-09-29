import { NavLink, Outlet } from 'react-router';
import { LogOut, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { appRoutes, canAccess } from '@/routes/routes';
import Toaster from '@/components/ui/Toaster';
import LanguageSwitcher from './LanguageSwitcher';

export default function AppShell() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const links = appRoutes.filter((r) => r.nav && canAccess(r.access, user?.role));

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
          <span className="text-lg font-black text-brand">{t('app.name')}</span>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto" aria-label="main">
            {links.map((r) => (
              <NavLink
                key={r.path}
                to={r.path}
                end={r.path === '/'}
                className={({ isActive }) =>
                  clsx(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold',
                    isActive ? 'bg-brand-light text-brand' : 'text-slate-600 hover:bg-slate-100',
                  )
                }
              >
                {t(r.titleKey)}
              </NavLink>
            ))}
          </nav>
          <LanguageSwitcher />
          {user ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden items-center gap-1.5 text-slate-600 sm:inline-flex">
                <UserRound className="h-4 w-4" aria-hidden />
                {user.full_name ?? user.phone} · {t(`roles.${user.role}`)}
              </span>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {t('auth.logout')}
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover"
            >
              {t('auth.login')}
            </NavLink>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}

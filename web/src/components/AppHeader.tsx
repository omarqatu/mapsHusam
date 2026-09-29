import { useCallback, useRef, useState } from 'react';
import { CircleHelp, Menu } from 'lucide-react';
import LegalModal from '@/features/legal/LegalModal';
import type { LegalKey } from '@/features/legal/types';
import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { useAuthStore } from '@/store/authStore';
import { appRoutes, canAccess } from '@/routes/routes';
import { InfoList } from './InfoMenu';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';
import UserMenu from './UserMenu';

const link = (isActive: boolean) =>
  clsx(
    'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
    isActive ? 'bg-surface/25 text-white' : 'text-white/85 hover:bg-surface/15',
  );

/**
 * The one top bar of the app (map and every other page): brand, the pages the user may open, language, account.
 * From `md` up the pages sit in the bar; on phones they fold into a menu button.
 */
export default function AppHeader() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const [open, setOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [legal, setLegal] = useState<LegalKey | null>(null);
  const info = useRef<HTMLDivElement>(null);
  const closeInfo = useCallback(() => setInfoOpen(false), []);
  useOutsideClick(info, closeInfo, infoOpen);
  const pick = (k: LegalKey) => {
    setOpen(false);
    setInfoOpen(false);
    setLegal(k);
  };
  const links = appRoutes.filter((r) => r.nav && canAccess(r.access, role));
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(menu, close, open);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 bg-gradient-to-l from-brand to-brand-2 px-3 text-white shadow">
      <NavLink to="/home" className="truncate text-base font-black sm:text-lg">
        {t('app.name')}
      </NavLink>

      <nav className="ms-3 hidden flex-1 items-center gap-1 md:flex" aria-label="main">
        {links.map((r) => (
          <NavLink key={r.path} to={r.path} end={r.path === '/'} className={({ isActive }) => link(isActive)}>
            {t(r.titleKey)}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1 md:hidden" />

      <div ref={menu} className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t('common.menu')}
          className="rounded-lg p-2 hover:bg-surface/15"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        {open && (
          <nav
            aria-label="main"
            className="fixed inset-x-2 top-14 z-50 mt-1 flex flex-col rounded-xl border border-line bg-surface p-1 text-fg shadow-xl"
          >
            {links.map((r) => (
              <NavLink
                key={r.path}
                to={r.path}
                end={r.path === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'rounded-lg px-3 py-2 text-sm font-semibold',
                    isActive ? 'bg-brand-light text-brand-fg' : 'hover:bg-subtle',
                  )
                }
              >
                {t(r.titleKey)}
              </NavLink>
            ))}
            <div className="my-1 border-t border-line" role="separator" />
            <InfoList onPick={pick} />
          </nav>
        )}
      </div>

      <div ref={info} className="relative hidden md:block">
        <button
          type="button"
          onClick={() => setInfoOpen((v) => !v)}
          aria-expanded={infoOpen}
          aria-label={t('info.title')}
          title={t('info.title')}
          className="rounded-lg p-2 hover:bg-surface/15"
        >
          <CircleHelp className="h-5 w-5" aria-hidden />
        </button>
        {infoOpen && (
          <div className="absolute end-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-line bg-surface p-1 text-fg shadow-xl">
            <InfoList onPick={pick} />
          </div>
        )}
      </div>
      <ThemeSwitcher />
      <LanguageSwitcher tone="onBrand" />
      <UserMenu tone="onBrand" />
      <LegalModal docKey={legal} onClose={() => setLegal(null)} />
    </header>
  );
}

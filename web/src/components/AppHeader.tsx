import { useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  ChartColumn,
  ChevronDown,
  EyeOff,
  CircleHelp,
  House,
  Languages,
  Map,
  MapPin,
  Menu,
  Moon,
  Palette,
  Radio,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Type,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import LegalModal from '@/features/legal/LegalModal';
import type { LegalKey } from '@/features/legal/types';
import { NavLink, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { useAuthStore } from '@/store/authStore';
import { appRoutes, canAccess, type AppRoute } from '@/routes/routes';
import { changeLanguage } from '@/i18n';
import { currentTheme, setTheme } from '@/lib/theme';
import { InfoList } from './InfoMenu';
import { useHeaderTone } from './headerStyles';
import UserMenu from './UserMenu';

const ICONS: Record<string, LucideIcon> = {
  '/home': House,
  '/': Map,
  '/search': Search,
  '/widgets/portal': Radio,
  '/admin/users': Users,
  '/admin/widgets': SlidersHorizontal,
  '/admin/texts': Type,
  '/admin/visibility': EyeOff,
  '/admin/appearance': Palette,
  '/admin/dashboard': ChartColumn,
};

const isAdmin = (r: AppRoute) => Array.isArray(r.access) && r.access.includes('admin');

const menuPanel = 'z-50 rounded-2xl border border-line bg-surface p-1.5 text-fg shadow-float';
const menuRow = (active = false) =>
  clsx(
    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-semibold',
    active ? 'bg-brand-light text-brand-fg' : 'hover:bg-subtle',
  );
const sectionLabel = 'px-3 pb-1 pt-2 text-xs font-bold text-muted';

/** A header dropdown: the trigger plus a panel that closes on outside click. */
function Dropdown({
  open,
  setOpen,
  trigger,
  children,
  panelClass,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  trigger: (toggle: () => void) => ReactNode;
  children: ReactNode;
  panelClass?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useOutsideClick(box as RefObject<HTMLElement | null>, close, open);
  return (
    <div ref={box} className="relative">
      {trigger(() => setOpen(!open))}
      {open && (
        <div className={clsx(menuPanel, panelClass ?? 'absolute end-0 top-full mt-2 w-64')}>{children}</div>
      )}
    </div>
  );
}

/** Language + theme as two menu rows (they are set once, so they live in a menu, not in the bar). */
function PreferenceRows() {
  const { t, i18n } = useTranslation();
  const [theme, setLocal] = useState(currentTheme);
  const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return (
    <>
      <button type="button" className={menuRow()} onClick={() => changeLanguage(nextLang)}>
        <Languages className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <span className="flex-1">{t('common.language')}</span>
        <span className="text-xs font-bold text-brand-fg">{nextLang === 'ar' ? 'العربية' : 'English'}</span>
      </button>
      <button
        type="button"
        className={menuRow()}
        onClick={() => {
          setTheme(nextTheme);
          setLocal(nextTheme);
        }}
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        ) : (
          <Moon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        )}
        {t(nextTheme === 'dark' ? 'common.themeDark' : 'common.themeLight')}
      </button>
    </>
  );
}

/**
 * The one top bar of the app (map and every other page). Its look is the admin's header style (/admin/appearance),
 * always in the brand colours.
 * Between md and lg the tabs show icons only (labels as tooltips) so the row never crowds. Desktop: brand · page tabs (+ one "admin" dropdown) · bell, requests, more, account.
 * Phones: brand · bell, requests, account, menu (pages, admin, preferences, info in one sheet).
 */
export default function AppHeader() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const role = useAuthStore((s) => s.user?.role);
  const [sheet, setSheet] = useState(false);
  const [more, setMore] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [legal, setLegal] = useState<LegalKey | null>(null);
  const pick = (k: LegalKey) => {
    setSheet(false);
    setMore(false);
    setLegal(k);
  };
  const links = appRoutes.filter((r) => r.nav && canAccess(r.access, role));
  const main = links.filter((r) => !isAdmin(r));
  const adminLinks = links.filter(isAdmin);
  const inAdmin = pathname.startsWith('/admin');
  const onMap = pathname === '/';
  const tone = useHeaderTone();
  const headerIconBtn = tone.iconBtn;

  const tab = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-sm font-bold transition-colors lg:px-3',
      isActive ? tone.tabOn : tone.tabOff,
    );

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 h-14 shrink-0',
        // On the map the bar is see-through glass over the imagery (the map canvas reaches up beneath it).
        onMap ? tone.glass : tone.bar,
      )}
    >
      <div className="flex h-full items-center gap-2 px-3 lg:px-5">
        <NavLink to={role ? '/home' : '/'} className="flex shrink-0 items-center gap-2.5">
          <span className={clsx('flex h-9 w-9 items-center justify-center rounded-xl', tone.mark)}>
            <MapPin className="h-5 w-5" aria-hidden />
          </span>
          <span className="whitespace-nowrap text-base font-black lg:text-lg">
            <span className="xl:hidden">{t('app.shortName')}</span>
            <span className="max-xl:hidden">{t('app.name')}</span>
          </span>
        </NavLink>

        <nav
          className={clsx('mx-auto hidden items-center gap-1 rounded-xl p-1 md:flex', tone.group)}
          aria-label="main"
        >
          {main.map((r) => {
            const Icon = ICONS[r.path];
            return (
              <NavLink key={r.path} to={r.path} end={r.path === '/'} className={tab} title={t(r.titleKey)}>
                {Icon && <Icon className="h-4 w-4" aria-hidden />}
                <span className="max-lg:sr-only">{t(r.titleKey)}</span>
              </NavLink>
            );
          })}
          {adminLinks.length > 0 && (
            <Dropdown
              open={admin}
              setOpen={setAdmin}
              panelClass="absolute start-0 top-full mt-2 w-56"
              trigger={(toggle) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={admin}
                  className={tab({ isActive: inAdmin })}
                  title={t('nav.admin')}
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  <span className="max-lg:sr-only">{t('nav.admin')}</span>
                  <ChevronDown
                    className={clsx('h-3.5 w-3.5 transition-transform', admin && 'rotate-180')}
                    aria-hidden
                  />
                </button>
              )}
            >
              {adminLinks.map((r) => {
                const Icon = ICONS[r.path];
                return (
                  <NavLink
                    key={r.path}
                    to={r.path}
                    onClick={() => setAdmin(false)}
                    className={({ isActive }) => menuRow(isActive)}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
                    {t(r.titleKey)}
                  </NavLink>
                );
              })}
            </Dropdown>
          )}
        </nav>
        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-1">
          <div className="hidden md:block">
            <Dropdown
              open={more}
              setOpen={setMore}
              trigger={(toggle) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={more}
                  aria-label={t('info.title')}
                  title={t('info.title')}
                  className={headerIconBtn}
                >
                  <CircleHelp className="h-5 w-5" aria-hidden />
                </button>
              )}
            >
              <PreferenceRows />
              <div className="my-1 border-t border-line" role="separator" />
              <p className={sectionLabel}>{t('info.title')}</p>
              <InfoList onPick={pick} />
            </Dropdown>
          </div>

          <UserMenu />

          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setSheet((v) => !v)}
              aria-expanded={sheet}
              aria-label={t('common.menu')}
              className={headerIconBtn}
            >
              {sheet ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {sheet && (
        <>
          <button
            type="button"
            aria-label={t('common.close')}
            className="fixed inset-0 top-14 z-40 bg-fg/30 md:hidden"
            onClick={() => setSheet(false)}
          />
          <nav
            aria-label="main"
            className={clsx(
              menuPanel,
              'fixed inset-x-2 top-16 max-h-[calc(100dvh-5rem)] overflow-y-auto md:hidden',
            )}
          >
            <div className="grid grid-cols-2 gap-1.5 p-1">
              {main.map((r) => {
                const Icon = ICONS[r.path];
                return (
                  <NavLink
                    key={r.path}
                    to={r.path}
                    end={r.path === '/'}
                    onClick={() => setSheet(false)}
                    className={({ isActive }) =>
                      clsx(
                        'flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-sm font-bold',
                        isActive ? 'bg-brand text-white' : 'bg-subtle text-fg',
                      )
                    }
                  >
                    {Icon && <Icon className="h-5 w-5" aria-hidden />}
                    {t(r.titleKey)}
                  </NavLink>
                );
              })}
            </div>
            {adminLinks.length > 0 && (
              <>
                <p className={sectionLabel}>{t('nav.admin')}</p>
                {adminLinks.map((r) => {
                  const Icon = ICONS[r.path];
                  return (
                    <NavLink
                      key={r.path}
                      to={r.path}
                      onClick={() => setSheet(false)}
                      className={({ isActive }) => menuRow(isActive)}
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
                      {t(r.titleKey)}
                    </NavLink>
                  );
                })}
              </>
            )}
            <div className="my-1 border-t border-line" role="separator" />
            <PreferenceRows />
            <div className="my-1 border-t border-line" role="separator" />
            <p className={sectionLabel}>{t('info.title')}</p>
            <InfoList onPick={pick} />
          </nav>
        </>
      )}
      <LegalModal docKey={legal} onClose={() => setLegal(null)} />
    </header>
  );
}

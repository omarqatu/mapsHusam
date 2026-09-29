import { useCallback, useRef, useState } from 'react';
import { ClipboardList, KeyRound, LogIn, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import clsx from 'clsx';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { useAuthStore } from '@/store/authStore';
import ChangePasswordDialog from '@/features/auth/ChangePasswordDialog';
import NotificationsMenu from '@/features/notifications/NotificationsMenu';
import { useRequestsUi } from '@/features/requests/store';
import { useUnseen } from '@/features/requests/unseen';

const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm font-semibold hover:bg-subtle';

/**
 * Header actions of the signed-in user: bell, my requests, and one account menu (name, role, change password,
 * log out). Signed out: a login link. `onBrand` = white icons for the gradient bar.
 */
export default function UserMenu({ tone = 'default' }: { tone?: 'default' | 'onBrand' }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(menu, close, open);
  const openRequests = useRequestsUi((s) => s.openList);
  const hasNew = useUnseen((s) => s.ids.length > 0);
  const btn = clsx(
    'relative inline-flex items-center rounded-lg px-2.5 py-1.5',
    tone === 'onBrand' ? 'text-white hover:bg-surface/15' : 'text-muted hover:bg-subtle',
  );

  if (!user) {
    return (
      <Link to="/login" className={clsx(btn, 'gap-1.5 whitespace-nowrap text-sm font-semibold')}>
        <LogIn className="h-4 w-4" aria-hidden />
        {t('auth.login')}
      </Link>
    );
  }
  const name = user.full_name ?? user.phone;
  return (
    <div className="flex items-center gap-0.5">
      <NotificationsMenu tone={tone} />
      <button
        type="button"
        onClick={openRequests}
        className={btn}
        aria-label={t('requests.myRequests')}
        title={t('requests.myRequests')}
      >
        <ClipboardList className="h-4 w-4" aria-hidden />
        {hasNew && <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-ok-solid ring-2 ring-ok-solid/40" />}
      </button>

      <div ref={menu} className="relative ms-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={name}
          title={name}
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-full text-sm font-black',
            tone === 'onBrand' ? 'bg-surface/25 text-white hover:bg-surface/35' : 'bg-brand-light text-brand-fg',
          )}
        >
          {name.trim().charAt(0).toUpperCase()}
        </button>
        {open && (
          <div
            role="menu"
            className="absolute end-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-line bg-surface p-1 text-fg shadow-xl"
          >
            <div className="border-b border-line px-3 py-2">
              <p className="truncate text-sm font-bold text-fg">{name}</p>
              <p className="text-xs text-muted">{t(`roles.${user.role}`)}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false);
                setPwdOpen(true);
              }}
            >
              <KeyRound className="h-4 w-4 text-muted" aria-hidden />
              {t('auth.changePassword.open')}
            </button>
            <button type="button" role="menuitem" className={clsx(item, 'text-danger')} onClick={logout}>
              <LogOut className="h-4 w-4" aria-hidden />
              {t('auth.logout')}
            </button>
          </div>
        )}
      </div>
      <ChangePasswordDialog open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </div>
  );
}

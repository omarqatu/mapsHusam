import { useState } from 'react';
import { ClipboardList, KeyRound, LogIn, LogOut, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import ChangePasswordDialog from '@/features/auth/ChangePasswordDialog';
import NotificationsMenu from '@/features/notifications/NotificationsMenu';
import { useRequestsUi } from '@/features/requests/store';
import { useUnseen } from '@/features/requests/unseen';

/** Current user + logout, or a login link. `onBrand` = white text for the gradient bar. */
export default function UserMenu({ tone = 'default' }: { tone?: 'default' | 'onBrand' }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [pwdOpen, setPwdOpen] = useState(false);
  const openRequests = useRequestsUi((s) => s.openList);
  const hasNew = useUnseen((s) => s.ids.length > 0);
  const btn = clsx(
    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold',
    tone === 'onBrand' ? 'text-white hover:bg-white/15' : 'text-slate-600 hover:bg-slate-100',
  );

  if (!user) {
    return (
      <Link to="/login" className={btn}>
        <LogIn className="h-4 w-4" aria-hidden />
        {t('auth.login')}
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1 text-sm">
      <span
        className={clsx(
          'hidden items-center gap-1.5 md:inline-flex',
          tone === 'onBrand' ? 'text-white/90' : 'text-slate-600',
        )}
      >
        <UserRound className="h-4 w-4" aria-hidden />
        {user.full_name ?? user.phone} · {t(`roles.${user.role}`)}
      </span>
      <NotificationsMenu tone={tone} />
      <button
        type="button"
        onClick={openRequests}
        className={clsx(btn, 'relative')}
        aria-label={t('requests.myRequests')}
        title={t('requests.myRequests')}
      >
        <ClipboardList className="h-4 w-4" aria-hidden />
        {hasNew && <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-green-400 ring-2 ring-green-700/40" />}
      </button>
      <button
        type="button"
        onClick={() => setPwdOpen(true)}
        className={btn}
        aria-label={t('auth.changePassword.open')}
        title={t('auth.changePassword.open')}
      >
        <KeyRound className="h-4 w-4" aria-hidden />
      </button>
      <ChangePasswordDialog open={pwdOpen} onClose={() => setPwdOpen(false)} />
      <button type="button" onClick={logout} className={btn} aria-label={t('auth.logout')}>
        <LogOut className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{t('auth.logout')}</span>
      </button>
    </div>
  );
}

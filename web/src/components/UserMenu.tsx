import { useCallback, useRef, useState } from 'react';
import {
  ChevronDown,
  ClipboardList,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import clsx from 'clsx';
import Avatar from '@/components/ui/Avatar';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { useAuthStore } from '@/store/authStore';
import ChangePasswordDialog from '@/features/auth/ChangePasswordDialog';
import NotificationsMenu from '@/features/notifications/NotificationsMenu';
import { useRequestsUi } from '@/features/requests/store';
import { useHeaderTone } from './headerStyles';
import { useUnseen } from '@/features/requests/unseen';

/** One line of the account card: icon, what it is, the value (numbers stay left-to-right inside Arabic text). */
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      <span className="shrink-0 text-muted">{label}</span>
      <bdi dir="ltr" className="ms-auto min-w-0 truncate font-semibold text-fg">
        {value}
      </bdi>
    </div>
  );
}

const item =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm font-semibold hover:bg-subtle';

/**
 * Header actions of the signed-in user: bell, my requests, and one account menu (name, role, my profile, change
 * password, log out). Signed out: a login button.
 */
export default function UserMenu() {
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
  const tone = useHeaderTone();

  if (!user) {
    return (
      <Link
        to="/login"
        className={clsx(
          'ms-1 inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm font-bold shadow-card transition-colors',
          tone.login,
        )}
      >
        <LogIn className="h-4 w-4" aria-hidden />
        {t('auth.login')}
      </Link>
    );
  }
  const name = user.full_name ?? user.phone;
  return (
    <div className="flex items-center gap-1">
      <NotificationsMenu />
      <button
        type="button"
        onClick={openRequests}
        className={tone.iconBtn}
        aria-label={t('requests.myRequests')}
        title={t('requests.myRequests')}
      >
        <ClipboardList className="h-5 w-5" aria-hidden />
        {hasNew && (
          <span
            className={clsx(
              'absolute end-2 top-2 h-2.5 w-2.5 rounded-full bg-ok-solid ring-2',
              tone.badgeRing,
            )}
          />
        )}
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
            'flex h-10 items-center gap-2 rounded-full ps-1 pe-1 transition-colors xl:pe-2.5',
            tone.accountBtn,
          )}
        >
          <Avatar name={name} className="h-9 w-9 text-sm" skin={tone.avatar} />
          <span className={clsx('max-w-32 truncate text-sm font-bold max-xl:hidden', tone.name)}>{name}</span>
          <ChevronDown
            className={clsx(
              'h-3.5 w-3.5 transition-transform max-xl:hidden',
              tone.chevron,
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute end-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-surface p-1.5 text-fg shadow-float"
          >
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 pb-2 pt-2.5 hover:bg-subtle"
            >
              <Avatar name={name} className="h-11 w-11 text-lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-fg">{name}</p>
                <span className="mt-0.5 inline-block rounded-full bg-brand-light px-2 py-0.5 text-xs font-bold text-brand-fg">
                  {t(`roles.${user.role}`)}
                </span>
              </div>
            </Link>
            <div className="border-y border-line py-1">
              <InfoRow icon={Phone} label={t('account.phone')} value={user.phone} />
              <InfoRow icon={MessageCircle} label={t('account.whatsapp')} value={user.whatsapp_number} />
              <InfoRow icon={Mail} label={t('account.email')} value={user.email} />
            </div>
            <Link to="/profile" role="menuitem" className={item} onClick={() => setOpen(false)}>
              <UserRound className="h-4 w-4 text-muted" aria-hidden />
              {t('profile.open')}
            </Link>
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

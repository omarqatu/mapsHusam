import { LogIn, MessageCircle, Send, Star, Store, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useLoginPrompt } from './loginPromptStore';

const PERKS = [
  { key: 'contact', Icon: MessageCircle },
  { key: 'request', Icon: Send },
  { key: 'rate', Icon: Star },
  { key: 'list', Icon: Store },
] as const;

/**
 * The visitor's "sign in to …" sheet: what an account adds, then log in / register. Both come back to the page the
 * visitor was on (`state.from`), so the listing they wanted to contact is still there.
 */
export default function LoginPrompt() {
  const { t } = useTranslation();
  const { reason, close } = useLoginPrompt();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const go = (to: '/login' | '/register') => {
    close();
    void navigate(to, { state: { from: pathname + search } });
  };
  return (
    <Modal
      open={reason !== null}
      onClose={close}
      sheetOnPhone
      widthClass="max-w-md"
      title={t(`loginPrompt.title.${reason ?? 'contact'}`)}
      footer={
        <div className="grid w-full grid-cols-2 gap-2">
          <Button
            variant="secondary"
            startIcon={<UserPlus className="h-4 w-4" aria-hidden />}
            onClick={() => go('/register')}
          >
            {t('loginPrompt.register')}
          </Button>
          <Button
            startIcon={<LogIn className="h-4 w-4 rtl:-scale-x-100" aria-hidden />}
            onClick={() => go('/login')}
          >
            {t('loginPrompt.login')}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted">{t(`loginPrompt.lead.${reason ?? 'contact'}`)}</p>
      <ul className="mt-4 space-y-2.5">
        {PERKS.map(({ key, Icon }) => (
          <li key={key} className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-light text-brand-fg">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-fg">{t(`loginPrompt.perks.${key}`)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">{t('loginPrompt.activation')}</p>
    </Modal>
  );
}

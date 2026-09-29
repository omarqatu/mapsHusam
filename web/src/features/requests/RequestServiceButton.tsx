import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import Button, { type ButtonProps } from '@/components/ui/Button';
import { toast } from '@/components/ui/toastStore';
import { useAuthStore } from '@/store/authStore';
import { useRequestsUi, type RequestTarget } from './store';

/**
 * "Request service" for a provider with a registered account: opens the confirm → send flow (RequestFlow).
 * A signed-out visitor (the map is public) is sent to the login form and comes back to this page afterwards.
 */
export default function RequestServiceButton({
  target,
  ...rest
}: { target: RequestTarget } & Omit<ButtonProps, 'onClick' | 'children'>) {
  const { t } = useTranslation();
  const start = useRequestsUi((s) => s.startRequest);
  const signedIn = useAuthStore((s) => !!s.user);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const onClick = () => {
    if (signedIn) return start(target);
    toast.info(t('requests.flow.loginFirst'));
    void navigate('/login', { state: { from: pathname + search } });
  };
  return (
    <Button
      startIcon={<Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />}
      onClick={onClick}
      title={signedIn ? undefined : t('requests.flow.loginFirst')}
      {...rest}
    >
      {t('popup.requestService')}
    </Button>
  );
}

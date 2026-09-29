import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button, { type ButtonProps } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useRequestsUi, type RequestTarget } from './store';

/**
 * "Request service" for a provider with a registered account: opens the confirm → send flow (RequestFlow).
 * Signed-out visitors get the "sign in first" message from the flow.
 */
export default function RequestServiceButton({
  target,
  ...rest
}: { target: RequestTarget } & Omit<ButtonProps, 'onClick' | 'children'>) {
  const { t } = useTranslation();
  const start = useRequestsUi((s) => s.startRequest);
  const signedIn = useAuthStore((s) => !!s.user);
  return (
    <Button
      startIcon={<Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />}
      onClick={() => start(target)}
      title={signedIn ? undefined : t('requests.flow.loginFirst')}
      {...rest}
    >
      {t('popup.requestService')}
    </Button>
  );
}

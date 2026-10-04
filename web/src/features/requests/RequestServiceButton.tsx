import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button, { type ButtonProps } from '@/components/ui/Button';
import { useLoginPrompt } from '@/features/auth/loginPromptStore';
import { useAuthStore } from '@/store/authStore';
import { isViewingLayer } from './appointment';
import { useRequestsUi, type RequestTarget } from './store';

/**
 * "Request service" for a provider with a registered account: opens the confirm → send flow (RequestFlow).
 * A signed-out visitor (the map is public) gets the login sheet, and comes back to this page afterwards.
 */
export default function RequestServiceButton({
  target,
  ...rest
}: { target: RequestTarget } & Omit<ButtonProps, 'onClick' | 'children'>) {
  const { t } = useTranslation();
  const start = useRequestsUi((s) => s.startRequest);
  const signedIn = useAuthStore((s) => !!s.user);
  const openLogin = useLoginPrompt((s) => s.open);
  const onClick = () => (signedIn ? start(target) : openLogin('request'));
  return (
    <Button
      startIcon={<Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />}
      onClick={onClick}
      title={signedIn ? undefined : t('requests.flow.loginFirst')}
      {...rest}
    >
      {t(isViewingLayer(target.serviceLayer) ? 'popup.requestViewing' : 'popup.requestService')}
    </Button>
  );
}

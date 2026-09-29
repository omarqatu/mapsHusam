import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/toastStore';

/**
 * On app start, ask the server whether the saved session is still valid (account deactivated or
 * force-logged-out while the browser was closed). Fails open, like legacy: a network/server hiccup
 * never logs anyone out — only an explicit `valid: false` does.
 */
export default function SessionVerifier() {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.user_id);

  useEffect(() => {
    if (userId === undefined) return;
    let cancelled = false;
    authApi
      .verifySession(userId)
      .then((res) => {
        if (cancelled || res.valid !== false) return;
        useAuthStore.getState().logout();
        const reasons = {
          force_logout: 'auth.sessionForceLogout',
          inactive: 'auth.sessionInactive',
          not_found: 'auth.sessionNotFound',
        } as const;
        toast.warning(
          t(
            res.reason && res.reason in reasons
              ? reasons[res.reason as keyof typeof reasons]
              : 'auth.sessionEnded',
          ),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, t]);

  return null;
}

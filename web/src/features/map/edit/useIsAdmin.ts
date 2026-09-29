import { useAuthStore } from '@/store/authStore';

/** The editing tools are for admins. A UI gate only — GeoServer's own login is the authority on who may write. */
export const useIsAdmin = () => useAuthStore((s) => s.user?.role === 'admin');

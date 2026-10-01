import { join } from 'node:path';

/**
 * The dev accounts created by `dev/dev.sh seed` (dev/README.md). The default specs are read-only; only the opt-in
 * `flows.spec.ts` (E2E_FLOWS=1) writes, and it puts back what it changes.
 */
export interface Account {
  phone: string;
  password: string;
}

export const ACCOUNTS = {
  admin: { phone: '0590000001', password: 'Admin#12345' },
  user: { phone: '0590000003', password: 'User#12345' },
  provider: { phone: '0590000002', password: 'Provider#12345' },
} as const satisfies Record<string, Account>;

// Keep generated state outside web/: Vite watches its project root, and writing auth/results below it can reload pages
// while the browser suite is running. Isolate by port so two intentional local runs cannot overwrite each other's sessions.
const e2ePort = process.env.E2E_PORT ?? '5199';
export const AUTH_DIR = join(import.meta.dirname, '..', '..', '..', '.playwright', e2ePort, 'auth');
export const statePath = (key: keyof typeof ACCOUNTS) => join(AUTH_DIR, `${key}.json`);

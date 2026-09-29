import { join } from 'node:path';

/** The dev accounts created by `dev/dev.sh seed` (dev/README.md). Read-only flows only: nothing here may change them. */
export interface Account {
  phone: string;
  password: string;
}

export const ACCOUNTS = {
  admin: { phone: '0590000001', password: 'Admin#12345' },
  user: { phone: '0590000003', password: 'User#12345' },
} as const satisfies Record<string, Account>;

export const AUTH_DIR = join(import.meta.dirname, '..', '.auth');
export const statePath = (key: keyof typeof ACCOUNTS) => join(AUTH_DIR, `${key}.json`);

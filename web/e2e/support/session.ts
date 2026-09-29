import { statePath } from './accounts';

/** `test.use(as('admin'))` — start the spec already logged in (session saved by global-setup.ts). */
export const as = (who: 'admin' | 'user') => ({ storageState: statePath(who) });

/** No session at all: a visitor. */
export const asVisitor = { storageState: { cookies: [], origins: [] } };

import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, request, type FullConfig } from '@playwright/test';
import { ACCOUNTS, AUTH_DIR, statePath, type Account } from './support/accounts';

/**
 * 1. Logs the seeded accounts in once, through the real login endpoint, and saves each session in the app's own format
 *    (localStorage `map_user`, see store/authStore.ts) as a Playwright storage state. Specs then start already logged in,
 *    so a login limit or a slow login cannot make an unrelated spec flaky. The login FORM is covered by its own spec.
 * 2. Warms the Vite dev server up: on a cold cache it discovers dependencies page by page and reloads the tab each time
 *    ("optimized dependencies changed"), which would hit whichever spec happens to be running.
 */
export default async function globalSetup(config: FullConfig) {
  const project = config.projects[0];
  const baseURL = project.use.baseURL as string;
  const backend = process.env.VITE_BACKEND_URL ?? 'http://localhost:3000';
  mkdirSync(AUTH_DIR, { recursive: true });

  const api = await request.newContext({ baseURL: backend });
  try {
    for (const key of ['admin', 'user', 'provider'] as const) {
      const account: Account = ACCOUNTS[key];
      let res;
      try {
        res = await api.post('/api/auth/login', { data: { phone: account.phone, password: account.password } });
      } catch {
        throw new Error(
          `Backend not reachable on ${backend}. Start it first: dev/dev.sh db-up && dev/dev.sh seed && dev/dev.sh server`,
        );
      }
      if (!res.ok()) {
        throw new Error(
          `Login of the ${key} account (${account.phone}) failed with HTTP ${res.status()}. Did you run dev/dev.sh seed?`,
        );
      }
      const { user } = (await res.json()) as { user: unknown };
      const state = {
        cookies: [],
        origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: 'map_user', value: JSON.stringify(user) }] }],
      };
      writeFileSync(statePath(key), JSON.stringify(state));
    }
  } finally {
    await api.dispose();
  }

  const browser = await chromium.launch(project.use.launchOptions);
  try {
    const context = await browser.newContext({ baseURL, storageState: statePath('admin') });
    const page = await context.newPage();
    // Twice: the first pass may be interrupted by a dependency-optimization reload, the second one must run clean.
    for (let pass = 0; pass < 2; pass++) {
      for (const [path, ready] of [
        ['/', '.ol-viewport canvas'],
        ['/search', 'h2'],
        ['/widgets/portal', 'h1'],
        ['/admin/users', 'h1'],
        ['/admin/dashboard', 'h1'],
        ['/admin/widgets', 'h1'],
        ['/notifications', 'h1'],
      ]) {
        await page.goto(path);
        await page.locator(ready).first().waitFor({ timeout: 60_000 });
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

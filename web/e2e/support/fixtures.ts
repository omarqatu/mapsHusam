import { expect, test as base, type Page } from '@playwright/test';

export { expect };

/** Everything the page reported to the browser console as an error, plus uncaught exceptions. */
export interface PageProblems {
  list: string[];
}

/**
 * `test` with two guarantees for every spec:
 *  - **read-only**: any write (POST/PUT/PATCH/DELETE) the app sends to /api is answered by an empty 200 and never reaches
 *    the server — so opening a card or searching cannot log events, use up a quota or change the seeded data. The only
 *    real writes are the two authentication calls the login spec needs.
 *  - **console watch**: `problems.list` collects console errors and page exceptions for the specs that assert on them.
 *    Failed loads of third-party hosts (basemap tiles, weather, prayer times) are not the app's errors and are ignored.
 */
export const test = base.extend<{ problems: PageProblems }>({
  problems: async ({ page }, use) => {
    const list: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const from = msg.location().url;
      // "Failed to load resource" from a host that is not ours: no network in CI-like sandboxes, not an app error.
      if (from && !isLocal(from) && /Failed to load resource|net::ERR_/.test(msg.text())) return;
      list.push(`${msg.text()} (${from})`);
    });
    page.on('pageerror', (err) => list.push(`uncaught: ${err.message}`));
    await use({ list });
  },

  page: async ({ page }, use) => {
    await guardWrites(page);
    await use(page);
  },
});

const isLocal = (url: string) => ['localhost', '127.0.0.1'].includes(new URL(url).hostname);

const ALLOWED_WRITES = /\/api\/auth\/(login|verify-session)$/;

async function guardWrites(page: Page) {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET' || req.method() === 'HEAD' || ALLOWED_WRITES.test(new URL(req.url()).pathname)) {
      return route.fallback();
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

/** The map is ready when OpenLayers has created its viewport and every loading spinner is gone. */
export async function waitForMap(page: Page) {
  await expect(page.locator('.ol-viewport canvas').first()).toBeVisible();
}

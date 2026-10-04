import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against the real dev stack (see dev/README.md → "Browser tests"):
 *   backend  http://localhost:3000  (`dev/dev.sh server`, seeded accounts, local GeoServer)
 *   frontend Vite dev server started below on E2E_PORT (default 5199), proxying /api, /geoserver-proxy, /socket.io to the backend
 * CI does not run these — they need the dev database. No browser is downloaded: the locally installed Chromium is used.
 */
const port = Number(process.env.E2E_PORT ?? 5199);
const baseURL = `http://localhost:${port}`;

/** PLAYWRIGHT_CHROMIUM, else the headless shell that `playwright install` left in ~/.cache/ms-playwright. */
function chromiumPath(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const root = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(root)) return undefined;
  return readdirSync(root)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse()
    .map((d) => join(root, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'))
    .find(existsSync);
}

const launchOptions = { executablePath: chromiumPath(), args: ['--no-sandbox'] };
const common = { baseURL, locale: 'ar', timezoneId: 'Asia/Jerusalem', launchOptions };

export default defineConfig({
  testDir: './e2e',
  // Generated traces must live outside Vite's web/ root; otherwise Vite sees each trace write and reloads the app.
  outputDir: `../.playwright/${port}/results`,
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 3,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: { ...common, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], ...common, viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        ...common,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npm exec vite -- --port ${port} --strictPort`,
    url: baseURL,
    // Reusing an arbitrary process on 5199 can test another branch/worktree. Make it an explicit local opt-in.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === '1',
    // Vite prints a stack trace for every websocket the closing browser tabs drop (harmless, and it buries the results).
    // If it cannot start, Playwright times out — run `npx vite` by hand to see why.
    stdout: 'ignore',
    stderr: 'ignore',
    timeout: 120_000,
    env: { VITE_BACKEND_URL: process.env.VITE_BACKEND_URL ?? 'http://localhost:3000' },
  },
});

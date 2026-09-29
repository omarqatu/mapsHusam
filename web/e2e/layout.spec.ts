import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { as, asVisitor } from './support/session';

/** Every screen at the project's width (desktop 1440 / phone 390): nothing may make the page scroll sideways. */
interface RouteCheck {
  path: string;
  /** An element that exists once the screen has rendered its content. */
  ready: string;
}

const loggedIn: RouteCheck[] = [
  { path: '/home', ready: 'h1' },
  { path: '/', ready: '.ol-viewport canvas' },
  { path: '/search', ready: 'h2' },
  { path: '/notifications', ready: 'h1' },
  { path: '/widgets/portal', ready: 'h1' },
  { path: '/widgets/ticker', ready: 'h1' },
  { path: '/admin/users', ready: 'h1' },
  { path: '/admin/dashboard', ready: 'h1' },
  { path: '/admin/widgets', ready: 'h1' },
  { path: '/legal/terms', ready: 'h1' },
];

// Log-in and register redirect a logged-in user away, so they are checked as a visitor.
const visitor: RouteCheck[] = [
  { path: '/welcome', ready: 'h1' },
  { path: '/login', ready: 'h1' },
  { path: '/register', ready: 'h1' },
  { path: '/search', ready: 'h2' },
  { path: '/widgets/portal', ready: 'h1' },
];

async function expectNoSidewaysScroll(page: Page, { path, ready }: RouteCheck) {
  await page.goto(path);
  await expect(page.locator(ready).first()).toBeVisible();
  // Loaded, not loading: a late list or card must not be able to widen the page after we looked.
  await expect(page.locator('.animate-spin')).toHaveCount(0);

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${path}: the page is ${scrollWidth}px wide in a ${clientWidth}px window`).toBeLessThanOrEqual(
    clientWidth,
  );
}

test.describe('logged in as admin (sees every page)', () => {
  test.use(as('admin'));
  for (const route of loggedIn) {
    test(`no horizontal overflow on ${route.path}`, ({ page }) => expectNoSidewaysScroll(page, route));
  }
});

test.describe('visitor', () => {
  test.use(asVisitor);
  for (const route of visitor) {
    test(`no horizontal overflow on ${route.path}`, ({ page }) => expectNoSidewaysScroll(page, route));
  }
});

import { ACCOUNTS } from './support/accounts';
import { expect, test, waitForMap } from './support/fixtures';
import { asVisitor } from './support/session';
import { t } from './support/i18n';

test.describe('visitor', () => {
  test.use(asVisitor);

  test('opening the map lands on the welcome page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(t('auth.welcome.title'));
    await expect(page.getByRole('link', { name: t('auth.welcome.login') })).toBeVisible();
    await expect(page.getByRole('link', { name: t('auth.welcome.register') })).toBeVisible();
  });

  test('a user logs in through the form and lands on the home page; the map opens from there', async ({
    page,
    problems,
  }) => {
    await page.goto('/login');
    await page.getByLabel(t('auth.phone')).fill(ACCOUNTS.user.phone);
    await page.getByLabel(t('auth.password')).fill(ACCOUNTS.user.password);
    await page.getByRole('button', { name: t('auth.loginSubmit') }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The session is the one the seeded "user" account gets: a plain user.
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('map_user') ?? '{}').role))
      .toBe('user');
    await expect(page.getByRole('banner').getByRole('button', { name: t('requests.myRequests') })).toBeVisible();

    // The map is a page of its own (`/`), reachable with the session the login created.
    await page.goto('/');
    await waitForMap(page);
    expect(problems.list).toEqual([]);
  });
});

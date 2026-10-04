import { ACCOUNTS } from './support/accounts';
import { expect, test } from './support/fixtures';
import { as } from './support/session';
import { t } from './support/i18n';

test.describe('admin', () => {
  test.use(as('admin'));

  test('sees the users list', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { level: 1, name: t('adminUsers.title') })).toBeVisible();
    await expect(page.getByText(t('errors.forbiddenTitle'))).toHaveCount(0);

    // Other specs and live tests add accounts, so find a seeded one through the filter (read-only) instead of
    // relying on its position in the list. The list is a table on desktop and cards on phones.
    await page.getByPlaceholder(t('adminUsers.filters.searchPlaceholder')).fill(ACCOUNTS.user.phone);
    await expect(page.getByText(ACCOUNTS.user.phone).first()).toBeVisible();
  });
});

test.describe('normal user', () => {
  test.use(as('user'));

  test('gets the forbidden page instead of the users list', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByText(t('errors.forbiddenTitle'))).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: t('adminUsers.title') })).toHaveCount(0);
  });
});

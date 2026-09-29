import { expect, test } from './support/fixtures';
import { as } from './support/session';
import { t } from './support/i18n';

test.use(as('user'));

test('the theme toggle switches to dark and back', async ({ page }) => {
  await page.goto('/search');
  const html = page.locator('html');
  // Start from a known theme whatever the machine prefers.
  await page.evaluate(() => localStorage.setItem('psm-theme', 'light'));
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: t('common.themeDark') }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('psm-theme'))).toBe('dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark'); // applied before paint from the saved choice

  await page.getByRole('button', { name: t('common.themeLight') }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

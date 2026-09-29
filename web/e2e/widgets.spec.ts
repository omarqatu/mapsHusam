import { expect, test } from './support/fixtures';
import { t } from './support/i18n';

// Public page: no login. Weather / prayer cards call third-party hosts and are not asserted here.
test('the information centre renders its price cards with values', async ({ page }) => {
  await page.goto('/widgets/portal');
  await expect(page.getByRole('heading', { level: 1, name: t('widgets.title') })).toBeVisible();

  for (const card of ['currency', 'gold', 'fuel', 'transport-inter', 'transport-intra']) {
    await expect(page.getByRole('heading', { name: t(`widgets.cards.${card}`) })).toBeVisible();
  }
  // The first card holds real rates (a number), not a loading spinner or an error.
  await expect(page.locator('#card-currency')).toContainText(/\d/);
  await expect(page.locator('#card-currency .animate-spin')).toHaveCount(0);

  // Tabs switch to the other cards.
  await page.getByRole('tab', { name: t('widgets.tabs.status') }).click();
  await expect(page.getByRole('heading', { name: t('widgets.cards.road-status') })).toBeVisible();
});

import { expect, test, waitForMap } from './support/fixtures';
import { pickService } from './support/data';
import { as } from './support/session';
import { t } from './support/i18n';

test.use(as('user'));

test('the home page greets the user and its search box continues on the search page', async ({ page, request }) => {
  const service = await pickService(request);
  await page.goto('/home');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const form = page.getByRole('search', { name: t('home.search.label') });
  await form.getByRole('searchbox').fill(service.name);
  await form.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(page.getByRole('region', { name: t('searchPage.keywordTitle', { term: service.name }) })).toBeVisible();
});

test('a logged-in user opening "/" gets the map, not the home page', async ({ page }) => {
  await page.goto('/');
  await waitForMap(page);
  await expect(page).toHaveURL(/\/$/);
});

import { expect, test } from './support/fixtures';
import { pickService } from './support/data';
import { as } from './support/session';
import { t } from './support/i18n';

test.use(as('user'));

test('a keyword search on the search page returns results', async ({ page, request }) => {
  const service = await pickService(request);
  await page.goto('/search');

  // Two search forms: the sticky bar (tucked under the header until the page scrolls) and the hero; type in the hero.
  const form = page.getByRole('search').last();
  await form.getByRole('searchbox').fill(service.name);
  await form.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/[?&]q=/);
  const results = page.getByRole('region', { name: t('searchPage.keywordTitle', { term: service.name }) });
  await expect(results).toBeVisible();
  await expect(results.getByRole('status')).toContainText(/\d/); // "N results"
  await expect(results.getByText(service.name).first()).toBeVisible();
});

test('"go to the map" from a search result opens the map with that listing\'s card', async ({ page, request }) => {
  const service = await pickService(request);
  await page.goto('/search');
  const form = page.getByRole('search').last();
  await form.getByRole('searchbox').fill(service.name);
  await form.locator('button[type="submit"]').click();

  const results = page.getByRole('region', { name: t('searchPage.keywordTitle', { term: service.name }) });
  await results.getByRole('button', { name: t('extras.featured.showOnMap') }).first().click();

  await expect(page).toHaveURL(/\/\?x=/);
  await expect(page.locator('aside').filter({ hasText: service.name })).toBeVisible();
});

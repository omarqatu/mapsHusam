import { expect, test } from './support/fixtures';
import { pickService } from './support/data';
import { as } from './support/session';
import { t } from './support/i18n';

test.use(as('user'));

test('a keyword search on the search page returns results', async ({ page, request }) => {
  const service = await pickService(request);
  await page.goto('/search');

  const form = page.getByRole('search');
  await form.getByRole('searchbox').fill(service.name);
  await form.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/[?&]q=/);
  const results = page.getByRole('region', { name: t('searchPage.keywordTitle', { term: service.name }) });
  await expect(results).toBeVisible();
  await expect(results.getByRole('status')).toContainText(/\d/); // "N results"
  await expect(results.getByText(service.name).first()).toBeVisible();
});

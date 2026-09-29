import { expect, test, waitForMap } from './support/fixtures';
import { pickService } from './support/data';
import { as } from './support/session';
import { t } from './support/i18n';

test.use(as('user'));

test('the map loads with markers and no console errors', async ({ page, problems }) => {
  // The services layer is read from GeoServer by view extent; wait for that answer rather than for a timeout.
  const services = page.waitForResponse(
    (r) => r.url().includes('typeName=services%3Aservice_all') && r.request().method() === 'GET',
  );
  await page.goto('/');
  await waitForMap(page);

  const res = await services;
  expect(res.ok()).toBe(true);
  const { features } = (await res.json()) as { features: unknown[] };
  expect(features.length).toBeGreaterThan(0);

  await expect(page.getByRole('button', { name: t('map.layers') })).toBeVisible();
  await expect(page.getByPlaceholder(t('search.globalPlaceholder'))).toBeVisible();
  expect(problems.list).toEqual([]);
});

test('a provider found in the search box opens its card with a contact / request button', async ({
  page,
  request,
}) => {
  const service = await pickService(request);
  await page.goto('/');
  await waitForMap(page);

  await page.getByPlaceholder(t('search.globalPlaceholder')).fill(service.name);
  const hit = page.getByRole('option').filter({ hasText: service.name }).first();
  await hit.click();

  const card = page.locator('aside').filter({ hasText: service.name });
  await expect(card).toBeVisible();
  // Called / WhatsApp for a plain provider, "request service" for a registered one — either way one way to reach them.
  const contact = card.getByRole('button', {
    name: new RegExp([t('popup.call'), t('popup.whatsapp'), t('popup.requestService')].join('|')),
  });
  await expect(contact.first()).toBeVisible();
});

test('the layers panel hides a whole group of service types at once', async ({ page }) => {
  await page.goto('/');
  await waitForMap(page);
  await page.getByRole('button', { name: t('map.layers') }).click();

  const panel = page.getByRole('complementary', { name: t('map.layers') });
  await expect(panel).toBeVisible();

  const groupName = t('extras.featured.groups.technicians');
  const group = panel.locator('details').filter({ has: page.getByRole('checkbox', { name: groupName }) });
  const groupBox = group.getByRole('checkbox', { name: groupName });
  const counter = group.locator('summary span[dir="ltr"]');

  await expect(groupBox).toBeChecked();
  const total = ((await counter.textContent()) ?? '').split('/')[1].trim();
  await expect(counter).toHaveText(`${total}/${total}`);

  await groupBox.uncheck();
  await expect(groupBox).not.toBeChecked();
  await expect(counter).toHaveText(`0/${total}`);

  // Every type inside the group is off, not only the group's own box.
  await group.locator('summary').click();
  const types = group.locator('input[id^="svc-"]');
  await expect(types).toHaveCount(Number(total));
  for (const box of await types.all()) await expect(box).not.toBeChecked();

  await groupBox.check();
  await expect(counter).toHaveText(`${total}/${total}`);
});

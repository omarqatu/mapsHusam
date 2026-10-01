import { readFileSync } from 'node:fs';
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { statePath } from './support/accounts';
import { t } from './support/i18n';

/**
 * The service request between real accounts, each in its own browser (Husam's TEST_PLAN.md §6–§8, §11): the user asks
 * the provider for the service, the provider accepts, they chat, both confirm, the numbers appear, the user rates;
 * reject; cancel with a reason; no duplicate; the provider's own panel (busy / available here with GPS); the admin's
 * dashboard and read-only view of the user. Unlike the other specs this one WRITES to the dev database, so it only runs
 * with E2E_FLOWS=1 and puts back what it changes (open requests are cancelled, the provider's status and location
 * restored). Desktop only: one run is enough, the phone layout of the same dialogs is covered by the other specs.
 */
test.skip(!process.env.E2E_FLOWS, 'writes to the dev database: run with E2E_FLOWS=1');
test.describe.configure({ mode: 'serial' });
// One project only: two runs at once would answer each other's requests (both use the same dev accounts).
test.skip(({ isMobile }) => isMobile, 'desktop project only');

const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:3000';
type Who = 'admin' | 'user' | 'provider';
interface Session {
  user_id: number;
  token: string;
  full_name: string;
}
const session = (who: Who): Session => {
  const state = JSON.parse(readFileSync(statePath(who), 'utf8')) as {
    origins: { localStorage: { value: string }[] }[];
  };
  return JSON.parse(state.origins[0].localStorage[0].value) as Session;
};

interface ServiceRow {
  service_layer: string;
  feature_id: number;
  status: number | string;
  x_coord: string | number;
  y_coord: string | number;
}
interface RequestRow {
  id: number;
  status: string;
  provider_user_id: number;
  user_id: number;
}

async function api<T>(
  request: APIRequestContext,
  who: Who,
  method: 'GET' | 'POST',
  path: string,
  data?: unknown,
) {
  const res = await request.fetch(BACKEND + path, {
    method,
    headers: { Authorization: `Bearer ${session(who).token}` },
    data,
  });
  return { status: res.status(), body: (await res.json().catch(() => ({}))) as T };
}

/**
 * Every request the dev provider still has open — from the dev user or anyone else (the banner shows the oldest first) —
 * is answered: pending ones rejected, accepted ones cancelled. Each scenario then starts with an empty queue.
 */
async function clearOpenRequests(request: APIRequestContext) {
  const provider = session('provider').user_id;
  const { body } = await api<{ requests: RequestRow[] }>(
    request,
    'provider',
    'GET',
    `/api/service-requests?provider_user_id=${provider}`,
  );
  for (const r of body.requests ?? []) {
    if (r.provider_user_id !== provider) continue;
    if (r.status === 'pending')
      await api(request, 'provider', 'POST', `/api/service-requests/${r.id}/respond`, { action: 'reject' });
    if (r.status === 'accepted')
      await api(request, 'provider', 'POST', `/api/service-requests/${r.id}/cancel`, {
        cancellation_reason: 'e2e cleanup',
      });
  }
}

/** The dev user's newest request to the dev provider. */
async function lastRequestId(request: APIRequestContext) {
  const { body } = await api<{ requests: RequestRow[] }>(
    request,
    'user',
    'GET',
    `/api/service-requests?user_id=${session('user').user_id}`,
  );
  return Math.max(
    ...(body.requests ?? [])
      .filter((r) => r.provider_user_id === session('provider').user_id)
      .map((r) => r.id),
  );
}

async function open(
  browser: Browser,
  who: Who | null,
  path: string,
  extra: Parameters<Browser['newContext']>[0] = {},
) {
  const context = await browser.newContext({
    ...(who ? { storageState: statePath(who) } : {}),
    locale: 'ar',
    timezoneId: 'Asia/Jerusalem',
    viewport: { width: 1440, height: 900 },
    ...extra,
  });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`uncaught: ${e.message}`));
  await page.goto(path);
  return { context, page, problems };
}

/** The linked feature as the map knows it (name and place), read through the app's own GeoServer proxy. */
async function featureProps(page: Page, s: ServiceRow) {
  const res = await page.request.get('/geoserver-proxy/services/ows', {
    params: {
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: 'services:service_all',
      outputFormat: 'application/json',
      featureID: `service_all.${s.feature_id}`,
    },
  });
  const { features } = (await res.json()) as {
    features: { properties: { name: string; location_name: string } }[];
  };
  return features[0].properties;
}

/**
 * Opens the provider's card from the map's search box: the type's first word ("سباك"), then the suggestion with this
 * feature's name and place (several plumbers share the name).
 */
async function openProviderCard(page: Page, s: ServiceRow) {
  const { name, location_name } = await featureProps(page, s);
  if (!new URL(page.url()).pathname.endsWith('/') || new URL(page.url()).search) await page.goto('/');
  await expect(page.locator('.ol-viewport canvas').first()).toBeVisible();
  await page
    .getByPlaceholder(t('search.globalPlaceholder'))
    .first()
    .fill(t(`services.${s.service_layer}`).split(' ')[0]);
  const hit = page.getByRole('option').filter({ hasText: name }).filter({ hasText: location_name }).first();
  await hit.click();
  const card = page
    .locator('aside')
    .filter({ has: page.getByRole('button', { name: t('popup.requestService') }) });
  await expect(card).toBeVisible();
  return card;
}

async function requestService(page: Page, service: ServiceRow) {
  const card = await openProviderCard(page, service);
  await card.getByRole('button', { name: t('popup.requestService') }).click();
  await page
    .getByRole('dialog', { name: t('requests.flow.title') })
    .getByRole('button', { name: t('requests.flow.send') })
    .click();
  await expect(page.getByText(t('requests.flow.sent'))).toBeVisible();
}

const chat = (page: Page) =>
  page.getByRole('dialog').filter({ has: page.getByRole('log', { name: t('requests.chat.log') }) });

async function say(page: Page, text: string) {
  const dialog = chat(page);
  await dialog.getByRole('textbox', { name: t('requests.chat.placeholder') }).fill(text);
  await dialog.getByRole('button', { name: t('requests.chat.send') }).click();
}

let service: ServiceRow;
const contexts: BrowserContext[] = [];

test.beforeAll(async ({ request }) => {
  const res = await api<{ success: boolean; service: ServiceRow }>(
    request,
    'provider',
    'GET',
    '/api/get-provider-service',
  );
  if (!res.body.success) throw new Error('the dev provider is not linked to a feature — run dev/dev.sh seed');
  service = res.body.service;
  await clearOpenRequests(request);
});

test.afterAll(async ({ request }) => {
  await clearOpenRequests(request);
  // Put the provider back where the seed had it, available.
  await api(request, 'provider', 'POST', '/api/update-service-status', {
    user_id: session('provider').user_id,
    service_layer: service.service_layer,
    feature_id: service.feature_id,
    status: 0,
    x_coord: Number(service.x_coord),
    y_coord: Number(service.y_coord),
  });
  await Promise.all(contexts.map((c) => c.close()));
});

test('A: request → accept → chat both ways → both confirm → numbers → rating', async ({
  browser,
  request,
}) => {
  const provider = await open(browser, 'provider', '/home');
  const user = await open(browser, 'user', '/');
  // The same account on a second device: live events must reach every open session, not only the newest one.
  const userElsewhere = await open(browser, 'user', '/home');
  contexts.push(provider.context, user.context, userElsewhere.context);

  await requestService(user.page, service);

  // The provider is told live (socket), with no reload: the banner with accept / reject.
  const banner = provider.page.getByRole('alertdialog', { name: t('requests.incoming.title') });
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await banner.getByRole('button', { name: t('requests.accept') }).click();

  // Accepting opens the chat on both sides.
  await expect(chat(provider.page)).toBeVisible();
  await expect(chat(user.page)).toBeVisible({ timeout: 20_000 });
  await expect(userElsewhere.page.getByText(t('requests.live.accepted')).first()).toBeVisible({
    timeout: 20_000,
  });

  // Messages arrive on the other side; markup is shown as text.
  const fromUser = `مرحبا من المستخدم <b>${Date.now()}</b>`;
  await say(user.page, fromUser);
  await expect(chat(provider.page).getByText(fromUser)).toBeVisible({ timeout: 15_000 });
  const fromProvider = `أهلاً، متى يناسبك؟ ${Date.now()}`;
  await say(provider.page, fromProvider);
  await expect(chat(user.page).getByText(fromProvider)).toBeVisible({ timeout: 15_000 });

  // The user confirms first and waits; then the provider confirms and the numbers appear on both sides.
  await chat(user.page)
    .getByRole('button', { name: t('requests.chat.confirm'), exact: true })
    .click();
  await user.page.getByRole('button', { name: t('requests.chat.confirmYes') }).click();
  await expect(
    chat(user.page).getByRole('button', { name: t('requests.chat.confirmWaiting') }),
  ).toBeVisible();

  await chat(provider.page)
    .getByRole('button', { name: t('requests.chat.confirm'), exact: true })
    .click();
  await provider.page.getByRole('button', { name: t('requests.chat.confirmYes') }).click();
  await expect(chat(provider.page).getByText(t('requests.contact.title'))).toBeVisible({ timeout: 15_000 });

  // The rating dialog opens for the user — unless this user already rated this business (one rating per user per
  // business), which is the case on every run after the first against the same dev database.
  const rating = user.page.getByRole('dialog', { name: t('requests.rating.title') });
  const alreadyRated = await api<{ hasRated: boolean }>(
    request,
    'user',
    'GET',
    `/api/service-requests/${await lastRequestId(request)}/rating-check`,
  );
  if (!alreadyRated.body.hasRated) {
    await expect(rating).toBeVisible({ timeout: 15_000 });
    await rating.getByRole('radio').last().click();
    await rating.getByRole('button', { name: t('requests.rating.submit') }).click();
    await expect(user.page.getByText(t('requests.rating.done')).first()).toBeVisible({ timeout: 15_000 });
  } else {
    await user.page.waitForTimeout(2_500); // longer than the dialog's delay: it must not come
    await expect(rating).toHaveCount(0);
  }

  // Under the rating window the user's chat shows the provider's numbers, and the message box is gone.
  await expect(chat(user.page).getByText(t('requests.contact.title'))).toBeVisible({ timeout: 15_000 });
  await expect(chat(user.page).getByRole('textbox', { name: t('requests.chat.placeholder') })).toHaveCount(0);

  expect(user.problems).toEqual([]);
  expect(provider.problems).toEqual([]);
});

test('B: the provider rejects; the user is told and may ask again', async ({ browser, request }) => {
  const provider = await open(browser, 'provider', '/home');
  const user = await open(browser, 'user', '/');
  contexts.push(provider.context, user.context);

  await requestService(user.page, service);
  const banner = provider.page.getByRole('alertdialog', { name: t('requests.incoming.title') });
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await banner.getByRole('button', { name: t('requests.reject') }).click();
  await expect(user.page.getByText(t('requests.live.rejected')).first()).toBeVisible({ timeout: 20_000 });

  // After a rejection a new request to the same provider is allowed.
  const again = await api<{ success: boolean; requestId: number }>(
    request,
    'user',
    'POST',
    '/api/service-requests',
    {
      service_layer: service.service_layer,
      feature_id: service.feature_id,
      provider_name: 'e2e',
      service_type: 'e2e',
    },
  );
  expect(again.status).toBe(200);
  await clearOpenRequests(request);
});

test('C: cancelling needs a reason, and the other side sees the chat closed', async ({
  browser,
  request,
}) => {
  const provider = await open(browser, 'provider', '/home');
  const user = await open(browser, 'user', '/');
  contexts.push(provider.context, user.context);

  await requestService(user.page, service);
  const banner = provider.page.getByRole('alertdialog', { name: t('requests.incoming.title') });
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await banner.getByRole('button', { name: t('requests.accept') }).click();
  await expect(chat(user.page)).toBeVisible({ timeout: 20_000 });

  await chat(user.page)
    .getByRole('button', { name: t('requests.cancel') })
    .click();
  const reason = user.page.getByRole('dialog', { name: t('requests.cancelDialog.title') });
  await reason.getByRole('button', { name: t('requests.cancelDialog.submit') }).click();
  await expect(reason.getByText(t('requests.cancelDialog.required'))).toBeVisible(); // no reason → refused
  await reason.getByRole('textbox').fill('تغيّر الموعد');
  await reason.getByRole('button', { name: t('requests.cancelDialog.submit') }).click();
  await expect(user.page.getByText(t('requests.cancelDialog.done')).first()).toBeVisible();

  // The provider's open chat closes live.
  await expect(chat(provider.page).getByText(t('requests.chat.closed.cancelled'))).toBeVisible({
    timeout: 20_000,
  });

  // The server refuses a cancel without a reason too.
  const bare = await api(request, 'user', 'POST', '/api/service-requests/1/cancel', {});
  expect(bare.status).toBe(400);
});

test('D: no duplicate request while one is waiting; a provider cannot ask himself', async ({
  browser,
  request,
}) => {
  const user = await open(browser, 'user', '/');
  contexts.push(user.context);
  await requestService(user.page, service);

  // The same provider again while the first one waits: refused before anything is sent.
  const card = await openProviderCard(user.page, service);
  await card.getByRole('button', { name: t('popup.requestService') }).click();
  await expect(user.page.getByText(t('requests.flow.alreadyPending')).first()).toBeVisible();
  const twice = await api(request, 'user', 'POST', '/api/service-requests', {
    service_layer: service.service_layer,
    feature_id: service.feature_id,
    provider_name: 'e2e',
    service_type: 'e2e',
  });
  expect(twice.status).toBe(409);
  await clearOpenRequests(request);

  const self = await api(request, 'provider', 'POST', '/api/service-requests', {
    service_layer: service.service_layer,
    feature_id: service.feature_id,
    provider_name: 'e2e',
    service_type: 'e2e',
  });
  expect(self.status).toBeGreaterThanOrEqual(400);
});

test('P: the provider goes busy, then available at his GPS position (the location is saved)', async ({
  browser,
  request,
}) => {
  // Al-Manara, Ramallah — the provider's phone reports this position.
  const provider = await open(browser, 'provider', '/', {
    permissions: ['geolocation'],
    geolocation: { latitude: 31.9038, longitude: 35.2034 },
  });
  contexts.push(provider.context);
  await expect(provider.page.locator('.ol-viewport canvas').first()).toBeVisible();

  // On a wide screen the panel opens by itself once the account is known (legacy did the same); the map button
  // toggles it, so press it only when the panel did not come up.
  const panel = provider.page.getByRole('complementary', { name: t('provider.title') });
  await expect(async () => {
    if (!(await panel.isVisible()))
      await provider.page.getByRole('button', { name: t('provider.title') }).click();
    await expect(panel).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  await panel.getByRole('button', { name: t('provider.busy') }).click();
  await expect(provider.page.getByText(t('provider.updatedBusy')).first()).toBeVisible();
  await expect(panel.getByText(t('provider.statusBusy'))).toBeVisible();
  let row = await api<{ service: ServiceRow }>(request, 'provider', 'GET', '/api/get-provider-service');
  expect(Number(row.body.service.status)).toBe(1);

  // A 10-second cooldown follows every change.
  await expect(panel.getByRole('button', { name: t('provider.availableHere') })).toBeEnabled({
    timeout: 15_000,
  });
  await panel.getByRole('button', { name: t('provider.availableHere') }).click();
  await expect(provider.page.getByText(t('provider.updatedAvailable')).first()).toBeVisible({
    timeout: 15_000,
  });
  row = await api<{ service: ServiceRow }>(request, 'provider', 'GET', '/api/get-provider-service');
  expect(Number(row.body.service.status)).toBe(0);
  // Al-Manara in Palestine Grid metres is about (169 463, 145 768); the saved point is within a few metres of it.
  expect(Math.abs(Number(row.body.service.x_coord) - 169_463)).toBeLessThan(150);
  expect(Math.abs(Number(row.body.service.y_coord) - 145_768)).toBeLessThan(150);
  expect(provider.problems).toEqual([]);
});

test('V: a visitor pressing "request service" is sent to the login form', async ({ browser }) => {
  const visitor = await open(browser, null, '/');
  contexts.push(visitor.context);
  const card = await openProviderCard(visitor.page, service);
  await card.getByRole('button', { name: t('popup.requestService') }).click();
  await expect(visitor.page).toHaveURL(/\/login$/);
});

test("M: the admin sees the requests on the dashboard and opens the user's account read-only", async ({
  browser,
}) => {
  const admin = await open(browser, 'admin', '/admin/dashboard');
  contexts.push(admin.context);
  await expect(admin.page.getByRole('table').getByText(session('user').full_name).first()).toBeVisible({
    timeout: 20_000,
  });

  await admin.page.goto(`/admin/users/${session('user').user_id}/view`);
  await expect(admin.page.getByText(session('user').full_name).first()).toBeVisible({ timeout: 20_000 });
  // The view lists the user's requests (Husam's q2: the admin session + X-Read-Only-View, both checked).
  await expect(admin.page.getByText(/مرفوض|ملغي|تم الاتفاق/).first()).toBeVisible({ timeout: 20_000 });
  expect(admin.problems).toEqual([]);
});

test("S: a third account cannot read, answer, cancel or rate somebody else's request (TEST_PLAN §15.2, §8)", async ({
  request,
}) => {
  const created = await api<{ requestId: number }>(request, 'user', 'POST', '/api/service-requests', {
    service_layer: service.service_layer,
    feature_id: service.feature_id,
    provider_name: 'e2e',
    service_type: 'e2e',
  });
  expect(created.status).toBe(200);
  const id = created.body.requestId;
  try {
    // The admin account plays the stranger here: it is neither the requester nor the provider.
    expect((await api(request, 'admin', 'GET', `/api/service-requests/${id}/messages`)).status).toBe(403);
    // Refused either way: 400 while the request is not accepted yet, 403 for a stranger once it is.
    expect([400, 403]).toContain(
      (
        await api(request, 'admin', 'POST', `/api/service-requests/${id}/message`, {
          message: 'x',
          sender_role: 'user',
        })
      ).status,
    );
    expect(
      (await api(request, 'admin', 'POST', `/api/service-requests/${id}/respond`, { action: 'accept' }))
        .status,
    ).toBe(403);
    expect(
      (
        await api(request, 'admin', 'POST', `/api/service-requests/${id}/cancel`, {
          cancellation_reason: 'x',
        })
      ).status,
    ).toBe(403);
    // The requester cannot answer his own request, and nobody can rate one that is not completed.
    expect(
      (await api(request, 'user', 'POST', `/api/service-requests/${id}/respond`, { action: 'accept' }))
        .status,
    ).toBe(403);
    expect(
      (await api(request, 'user', 'POST', `/api/service-requests/${id}/rating`, { rating: 5 })).status,
    ).toBe(400);
    expect(
      (await api(request, 'user', 'POST', `/api/service-requests/${id}/rating`, { rating: 6 })).status,
    ).toBe(400);
    // Another user's list: refused.
    expect(
      (await api(request, 'admin', 'GET', `/api/service-requests?user_id=${session('user').user_id}`)).status,
    ).toBe(403);
  } finally {
    await clearOpenRequests(request);
  }
});

test('N: the admin sends a notification to one user; the user, signed in elsewhere, gets it live (TEST_PLAN §10)', async ({
  browser,
}) => {
  const user = await open(browser, 'user', '/home');
  const admin = await open(browser, 'admin', '/notifications');
  contexts.push(user.context, admin.context);

  await expect(admin.page.getByRole('heading', { name: t('notify.title') })).toBeVisible();
  const title = `تنبيه اختبار ${Date.now()}`;
  // Nothing goes out without a user ID, a title and a message.
  await admin.page.getByRole('button', { name: t('notify.send') }).click();
  await expect(admin.page.getByText(t('notify.errors.title.required'))).toBeVisible();

  await admin.page.getByLabel(t('notify.userId')).fill(String(session('user').user_id));
  await admin.page.getByLabel(t('notify.titleLabel')).fill(title);
  await admin.page.getByLabel(t('notify.message')).fill('<b>نص</b> الإشعار');
  await admin.page.getByRole('button', { name: t('notify.send') }).click();
  await expect(admin.page.getByText(/وصل فوراً إلى [1-9]/).first()).toBeVisible({ timeout: 15_000 });

  // The user sees it at once (toast), as text.
  await expect(user.page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  expect(admin.problems).toEqual([]);
  expect(user.problems).toEqual([]);
});

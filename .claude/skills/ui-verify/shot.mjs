#!/usr/bin/env node
// Screenshot a page of the running app (or the legacy site) at desktop / phone width, logged in or not.
//   node .claude/skills/ui-verify/shot.mjs <url> [--as user|admin|provider] [--sizes desk,phone,tablet]
//        [--out <dir>] [--lang ar|en] [--scheme dark] [--click "<button name>"]… [--scroll <px>] [--full]
// Prints, per size, whether the page overflows horizontally and any page errors. Files: <out>/<name>-<size>.png
import { createRequire } from 'node:module';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const { chromium } = createRequire(join(root, 'web', 'package.json'))('playwright');

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:/.test(a));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
if (!url) {
  console.error('usage: shot.mjs <url> [--as user|admin|provider] [--sizes desk,phone] [--out dir] [--lang ar] [--click name] [--scroll px] [--full]');
  process.exit(2);
}
const SIZES = { desk: { width: 1440, height: 900 }, tablet: { width: 1024, height: 800 }, phone: { width: 390, height: 844 } };
const ACCOUNTS = { admin: ['0590000001', 'Admin#12345'], provider: ['0590000002', 'Provider#12345'], user: ['0590000003', 'User#12345'] };
const out = opt('out', join(process.env.TMPDIR ?? '/tmp', 'ui-verify'));
mkdirSync(out, { recursive: true });
const name = (opt('name') ?? new URL(url).pathname.replace(/\W+/g, '_').replace(/^_|_$/g, '')) || 'home';

function chromiumPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const base = join(process.env.HOME, '.cache', 'ms-playwright');
  const dir = existsSync(base) ? readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop() : null;
  return dir ? join(base, dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell') : undefined;
}

// Both the React app and the legacy pages keep the login `user` object in localStorage `map_user`.
let user = null;
const who = opt('as');
if (who) {
  const [phone, password] = ACCOUNTS[who];
  const res = await fetch(`${opt('api', 'http://localhost:3000')}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  if (!res.ok) throw new Error(`login as ${who} failed: ${res.status} (is dev/dev.sh server up and seeded?)`);
  user = (await res.json()).user;
}

const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--no-sandbox'] });
for (const size of opt('sizes', 'desk,phone').split(',')) {
  const ctx = await browser.newContext({ viewport: SIZES[size], locale: opt('lang', 'ar'), colorScheme: opt('scheme', 'light') });
  if (user) await ctx.addInitScript((u) => localStorage.setItem('map_user', JSON.stringify(u)), user);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Legacy pages never go network-idle (sockets, tiles); fall back to a fixed wait.
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => page.waitForTimeout(3000));
  await page.waitForTimeout(1200);
  // --click may repeat: each one in order (open a dialog, then a tab in it, …).
  for (const [i, a] of args.entries()) {
    if (a !== '--click' || !args[i + 1]) continue;
    await page.getByRole('button', { name: args[i + 1] }).first().click();
    await page.waitForTimeout(600);
  }
  const scroll = Number(opt('scroll', 0));
  if (scroll) {
    await page.evaluate((y) => scrollTo(0, y), scroll);
    await page.waitForTimeout(400);
  }
  const file = join(out, `${name}-${size}.png`);
  await page.screenshot({ path: file, fullPage: args.includes('--full') });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log(`${size}: ${file}  overflow-x=${overflow}${errors.length ? '  errors=' + JSON.stringify(errors) : ''}`);
  await ctx.close();
}
await browser.close();

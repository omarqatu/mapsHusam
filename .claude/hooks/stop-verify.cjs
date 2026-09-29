#!/usr/bin/env node
'use strict';

// Stop hook: when files under web/ changed, run typecheck + lint once at the end of the turn and
// block the stop with the errors so they get fixed before the turn ends. The same report is not
// blocked twice in a row (state in .claude/hooks/.stop-verify-state.json, gitignored), so a
// failure that can't be fixed in this turn doesn't loop forever.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function sh(cmd, cwd) {
  try {
    return { ok: true, out: execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

const done = (payload) => {
  if (payload) process.stdout.write(JSON.stringify(payload));
  process.exit(0);
};

const rootRes = sh('git rev-parse --show-toplevel');
if (!rootRes.ok) done();
const root = rootRes.out.trim();
const web = path.join(root, 'web');
if (!fs.existsSync(path.join(web, 'node_modules'))) done(); // not scaffolded / not installed yet

const status = sh('git status --porcelain=v1 --no-renames', root);
if (!status.ok) done();
const webChanged = status.out
  .split('\n')
  .filter(Boolean)
  .some((l) => /^web\/(src\/|[^/]+\.(ts|tsx|js|json)$)/.test(l.slice(3).trim()));
if (!webChanged) done();

const findings = [];
const pkg = JSON.parse(fs.readFileSync(path.join(web, 'package.json'), 'utf8'));
for (const script of ['typecheck', 'lint']) {
  if (!pkg.scripts || !pkg.scripts[script]) continue;
  const r = sh(`npm run --silent ${script}`, web);
  if (!r.ok) findings.push(`web: \`npm run ${script}\` failed:\n${r.out.trim().slice(-6000)}`);
}

const stateFile = path.join(root, '.claude', 'hooks', '.stop-verify-state.json');
if (findings.length === 0) {
  try { fs.unlinkSync(stateFile); } catch {}
  done();
}

const report = findings.join('\n\n');
const hash = crypto.createHash('sha1').update(report).digest('hex');
let last = null;
try { last = JSON.parse(fs.readFileSync(stateFile, 'utf8')).hash; } catch {}
if (last === hash) done(); // already surfaced once; don't loop
try { fs.writeFileSync(stateFile, JSON.stringify({ hash })); } catch {}

done({ decision: 'block', reason: `Fix these before finishing:\n\n${report}` });

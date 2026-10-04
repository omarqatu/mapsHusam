#!/usr/bin/env node
'use strict';

// SessionStart: give the session the migration status up front, so it doesn't spend turns
// re-discovering where the work stands.

const fs = require('fs');
const path = require('path');

const plan = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), 'docs', 'react-migration', 'PLAN.md');
let text;
try { text = fs.readFileSync(plan, 'utf8'); } catch { process.exit(0); }

const lines = text.split('\n').filter((l) => /^\s*([|-]|\d+\.)/.test(l)); // status rows only, not the legend
const count = (mark) => lines.filter((l) => l.includes(mark)).length;
const inProgress = lines.filter((l) => l.includes('🟨')).map((l) => l.trim()).slice(0, 10);
const next = lines.find((l) => l.includes('⬜'));

const summary = [
  `React migration status (docs/react-migration/PLAN.md): ✅ ${count('✅')} · 🟨 ${count('🟨')} · ⬜ ${count('⬜')} · 🗑️ ${count('🗑️')}`,
  inProgress.length ? `In progress:\n${inProgress.join('\n')}` : 'Nothing in progress.',
  next ? `Next not-started item: ${next.trim()}` : '',
].filter(Boolean).join('\n');

process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: summary } }));

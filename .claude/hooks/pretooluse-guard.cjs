#!/usr/bin/env node
'use strict';

// PreToolUse guard for the React migration (see CLAUDE.md invariants):
//   Bash        - deny bulk `git add` and staging node_modules / dist / .env.
//   Edit/Write  - deny innerHTML / dangerouslySetInnerHTML in web/src (XSS),
//                 ask before touching the backend (server.js, server/) — functionality-preserving changes only.

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw || '{}'); } catch { process.exit(0); }

  const tool = input.tool_name || '';
  const ti = input.tool_input || {};

  const decide = (decision, reason) => {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason },
    }));
    process.exit(0);
  };

  if (tool === 'Bash') {
    // Ignore heredoc bodies (commit messages) so prose doesn't trip the guard.
    const cmd = String(ti.command || '').replace(/<<-?['"]?(\w+)['"]?\r?\n[\s\S]*?\r?\n[ \t]*\1\b/g, '');
    if (/\bgit\s+add\s+(-A\b|--all\b|\.(\s|$))/.test(cmd)) {
      decide('deny', 'Bulk `git add` is not allowed here — stage files by name (CLAUDE.md).');
    }
    if (/\bgit\s+add\b[^\n;&|]*(node_modules|(^|[\s/])dist\b|\.env\b)/.test(cmd)) {
      decide('deny', 'node_modules, dist and .env must never be committed.');
    }
    process.exit(0);
  }

  if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit') {
    const file = String(ti.file_path || '').replace(/\\/g, '/');
    const text = [ti.content, ti.new_string, ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e.new_string) : [])]
      .filter(Boolean)
      .join('\n');

    if (/\/web\/src\//.test(file) && /\b(innerHTML|dangerouslySetInnerHTML)\b/.test(text)) {
      decide('deny', 'No innerHTML / dangerouslySetInnerHTML in the React app — render user content through JSX (CLAUDE.md).');
    }
    if (/(^|\/)server\.js$|(^|\/)server\/.+\.js$/.test(file)) {
      decide('ask', 'The backend (server.js, server/) is frozen during the migration. Only security fixes (own commit) or serving web/dist. Log other needs under "Backend asks" in docs/react-migration/PLAN.md.');
    }
  }
  process.exit(0);
});

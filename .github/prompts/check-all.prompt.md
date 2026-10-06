---
mode: agent
description: Run every check before a commit or push
---
Run the checks and fix what fails (do not skip or weaken a test):

1. `cd web && npm run typecheck && npm run lint && npm test`
2. From the repo root: `npm run check:server && npm test` (server modules and `lib/` unit tests).
3. Re-read your own diff as a reviewer would: leftover emoji, hard-coded UI text, `ml-`/`mr-`/`left-`/`right-`, raw `fetch`,
   `innerHTML`, a locale key missing in `ar.json` or `en.json`.

Report what passed and what did not, with the output of anything that failed.

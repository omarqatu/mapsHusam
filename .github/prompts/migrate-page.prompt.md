---
mode: agent
description: Port one legacy page or feature to the React app in web/
---
Port ${input:page:the legacy page or feature to port} to React. One page per session.

1. Inventory first. Find its row in `docs/react-migration/PLAN.md`. Read the legacy HTML and every `js/` file it loads
   (the legacy files were deleted in commit `0239d8a`; read them with `git show 0239d8a^:<file>`). Write a parity
   checklist under the row: API calls with the response fields used, socket events, user actions, role differences, storage
   keys, mobile behaviour. For each API call open the handler in `server/routes/` and copy the exact response shape into the
   TypeScript type; do not guess field names.
2. Build it following `.github/instructions/web-ui.instructions.md` (feature-first folders, TanStack Query, typed `api/*.ts`
   calls, `t()` keys in both locales, logical Tailwind classes, no `innerHTML`, no emoji).
3. Verify: `cd web && npm run typecheck && npm run lint && npm test`, then run the backend and `npm run dev` and walk the
   parity checklist at desktop width and at 390 px. Tick items in PLAN.md; write down anything you could not verify.
4. Register the route, delete the legacy files only if nothing else loads them, update PLAN.md, and commit with files staged
   by name: `feat(web): port <page> to React`.

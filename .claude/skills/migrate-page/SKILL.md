---
name: migrate-page
description: Port one legacy page or feature (root *.html + js/*.js + css/*.css) to the React app in web/. Use whenever converting, rewriting, or "moving to React" any screen, panel, or feature of the PSM map.
---

# Porting a legacy page to React

One page (or one feature of the map page) per session. Don't start the next until this one is ✅.

## 1. Inventory — before writing any code

1. Find the page's row in `docs/react-migration/PLAN.md`; mark it 🟨.
2. Read the legacy HTML and every `js/` file it loads. Write its **parity checklist** into PLAN.md
   under the row: API calls (+ response fields actually used), socket events, user actions, role
   differences, storage keys, mobile behaviour. Use grep, e.g.
   `grep -nE "fetch\(|authFetch\(|socket\.(on|emit)|localStorage" js/<file>.js`.
3. For each API call, open the handler in `server/routes/` (`grep -rn "'/api/…'" server/`) and note the exact response shape — that
   becomes the TypeScript type. Don't guess field names.

## 2. Build

Layout (feature-first):

```
web/src/
  api/<domain>.ts            # typed calls via client.ts
  features/<feature>/
    hooks/use<Thing>.ts      # TanStack Query hooks (queryKey: ['<domain>', ...args])
    components/*.tsx
    <Feature>Page.tsx        # the route element
  components/ui/             # shared — check here first
  locales/{ar,en}.json
```

Rules:
- Server data → TanStack Query (mutations invalidate the matching keys). Client-only UI state →
  local state or a Zustand store. No server data in Zustand.
- No `innerHTML`, no `dangerouslySetInnerHTML`. Rich text from legacy (e.g. `legal-content.js`)
  becomes JSX.
- Text via `t('...')`, keys added to **both** `ar.json` and `en.json`.
- Tailwind logical classes only (`ms-/me-/ps-/pe-/start-/end-`).
- Legacy global functions (`window.x = ...`) and cross-file calls become props, hooks, or a store —
  never re-attach to `window`.
- Anything reused twice → `components/ui/`. If Enterprise-APP has the same component, mirror its API.
- Map work → load the `ol-map` skill.

## 3. Verify

- `npm run typecheck && npm run lint && npm test` in `web/` (the Stop hook also runs typecheck+lint).
- A Vitest test for every non-trivial hook/util (filters, formatters, permission logic).
- Run backend + `npm run dev`, walk the parity checklist item by item at desktop width and at 390px.
  Tick each item in PLAN.md. Anything that can't be verified locally is written down, not ticked.

## 4. Switch

- Register the route; point legacy links at it.
- Delete the legacy HTML/JS/CSS **only if** nothing else loads them (`grep -rn "<file>" *.html js/`).
- Mark ✅ (or 🗑️ if deleted) in PLAN.md. Commit with the files staged by name:
  `feat(web): port <page> to React`.

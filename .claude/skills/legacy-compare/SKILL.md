---
name: legacy-compare
description: Open the legacy (pre-React) page next to its React replacement to see what the old one did or looked like. Use when the user says "like the old one", "take the idea from the old version", "بالشكل القديم", or when checking parity for a page being ported.
---

# Comparing with the legacy page

The legacy frontend was deleted (commit `0239d8a`); the last version lives on `origin/main` (or `git show <commit>^:file`).
Reading its source is not enough for a *look* question — run it.

## 1. Serve it (backend must be up: `dev/dev.sh server`)

```bash
node .claude/skills/legacy-compare/serve.mjs origin/main 5188 &     # note the PID; stop it with kill <PID>
```

It exports the ref into `$TMPDIR/legacy-<ref>` and serves it with `/api`, `/geoserver-proxy`, `/save-stat`, `/socket.io`
proxied to `:3000`. Legacy pages redirect to `/original-index.html` without a session — always pass `--as`.

## 2. Screenshot both

```bash
S=<scratchpad>
node .claude/skills/ui-verify/shot.mjs http://localhost:5188/no-map-search.html --as user --name legacy --out $S
node .claude/skills/ui-verify/shot.mjs http://localhost:5174/search --name current --out $S
```

Legacy pages never go network-idle; expect the script's 3 s fallback. `--click` needs an accessible button name; legacy
buttons are often icon + text, so for a specific tab use a small Playwright snippet with the CSS selector instead
(`.nms-group-tab[data-group="realestate"]`, `.nms-category-card`).

## 3. Decide what to take

Legacy rules of thumb for this project (see `docs/react-migration/PLAN.md` for each page's item):
- Keep **features**, drop legacy **formats** (memory: no legacy-compat layers) — and record each deliberate change under the
  page's PLAN item.
- A layout idea from legacy is fine to copy (`no-map-search`: group tab bar + icon tiles + side columns of featured listings);
  its CSS is not (`css/design-system.css` tokens are the only style source that carries over, already in `web/src/index.css`).
- The legacy source for a behaviour: `git show origin/main:js/<file>.js`.

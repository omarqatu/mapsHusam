# Prompts to paste into Claude Code (local machine)

Open Claude Code in `mapsHusam/` and add the water project (`../pwa-1`, remote Enterprise-APP) as an
extra directory, so it can read the reference without leaving this repo:

```
claude --add-dir ../pwa-1
```

(or `/add-dir ../pwa-1` inside a running session, or once in `.claude/settings.json` →
`permissions.additionalDirectories`)

## Session 1 — Foundation (Phase 0)

```
Read CLAUDE.md and docs/react-migration/PLAN.md. Do Phase 0 only, no pages.
Reference for style and shared components: ../pwa-1/clients/web (read
.agents/skills/react/SKILL.md and src/components/ui/ first; mirror component APIs, drop tenancy
and module RBAC). Delete frontend-react/. Scaffold web/ with the fixed stack. Before building the
API client and auth store, read the login/verify-session/change-password handlers in server.js
and type their exact responses. Tick items in PLAN.md as you finish them. Stop after Phase 0 and
show me the route list and the ui kit.
```

## Every page after that

```
/migrate-page <route from PLAN.md, e.g. /admin/users>
```

Start with Phase 1 (simple admin pages) to shake out the foundation, then `/search`, then the
map in the Phase 3 order — one feature per session.

## Tips that make Claude faster here

- **One page per session**, then `/clear`. PLAN.md + the SessionStart hook carry the state, so
  the next session knows where things stand without re-reading everything.
- Use **plan mode** (Shift+Tab) for the map features in Phase 3 — review the plan before it writes.
- Keep the backend + GeoServer running in a separate terminal so Claude can verify pages for real.
- The hooks already block: bulk `git add`, committing `node_modules`/`dist`/`.env`, `innerHTML` in
  `web/src`, and they ask before `server.js` edits. Typecheck + lint run automatically when Claude
  finishes a turn.

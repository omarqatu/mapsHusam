---
name: ui-verify
description: Look at a page of the running React app (or the legacy site) in a real browser — screenshots at desktop / tablet / phone width, logged in or as a visitor, with a horizontal-overflow check. Use after ANY visible UI change, and whenever the user says a page "looks wrong" / "مش عجبتني" before proposing a fix.
---

# Seeing the page

Type checks and unit tests do not tell you whether a page looks right. Look at it before saying it is done — and look at
the *current* state before redesigning it.

## Run

```bash
dev/dev.sh server                # backend :3000 (seeded accounts, see dev/README.md)
cd web && npm run dev            # Vite; note the port it prints (5173, or the next free one)
node .claude/skills/ui-verify/shot.mjs http://localhost:5174/search --sizes desk,phone
node .claude/skills/ui-verify/shot.mjs http://localhost:5174/search --as user --click "المهن الحرة" --scroll 300
```

Options: `--as user|admin|provider` (logs in through the real API, puts the user in localStorage `map_user` — works for the
React app and the legacy pages), `--sizes desk,tablet,phone`, `--lang ar|en`, `--click "<button name>"`, `--scroll <px>`,
`--scheme dark` (the OS dark scheme; the app follows it when no theme was picked), `--full`, `--out <dir>` (default `$TMPDIR/ui-verify`; use the session scratchpad). It prints the PNG paths, whether the page
overflows horizontally, and any page errors. Then **Read the PNGs** — that is the point.

## Check every time

- Desktop 1440 **and** phone 390 (tablet 1024 when a layout switches at `md`/`xl`).
- `overflow-x=false` on all sizes.
- Arabic (default) — RTL: nothing pushed to the wrong side, arrows and chevrons point the right way. Then `--lang en` if the change has text or icons with direction.
- Text ≥ 14 px, no cut-off names, no two things fighting for the same row.
- `--scheme dark` once: tinted surfaces, badges and overlays must still read.
- A state, not only the landing: open a group / a result / a dialog with `--click`.

## Gotchas

- Playwright's own browser download is not used here: the script finds the headless shell in `~/.cache/ms-playwright`
  (`PLAYWRIGHT_CHROMIUM` overrides). "Executable doesn't exist" ⇒ the version folder changed; the script picks the newest.
- The login rate limiter locks a phone after repeated failures (15 min) — do not loop the script with a wrong password.
- An `sr-only` span (position: absolute) inside a horizontally scrolled row with no `relative` ancestor stretches the whole
  document (`overflow-x=true` with nothing visibly wrong). Give the card `relative`. To find such a leak: hide elements
  whose rect is off-screen one by one and watch `document.documentElement.scrollWidth`.
- Never kill a helper with `pkill -f <name>` inside the same shell command as the name (it matches the shell itself, exit 144);
  run it in the background and kill by PID.

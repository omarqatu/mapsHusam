---
mode: agent
description: See what the legacy (pre-React) page did or looked like
---
Compare ${input:page:the page or feature} with the legacy version.

The legacy frontend was deleted in commit `0239d8a`; read any legacy file with `git show 0239d8a^:<file>`
(for example `0239d8a^:js/layers.js`). Read the legacy source for the behaviour, then decide what to take:
keep the features, drop the legacy formats and CSS (only the design tokens in `web/src/index.css` carry over). Record each
deliberate change under the page's item in `docs/react-migration/PLAN.md`.

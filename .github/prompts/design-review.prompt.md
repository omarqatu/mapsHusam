---
mode: agent
description: Look at a page and improve it (marketplace-style pages: search, listings, categories)
---
Review and improve ${input:page:the page or component to review}. Look first, change one thing at a time, look again.

Patterns for classifieds and directory sites (OpenSooq, Haraj, Dubizzle, OLX):
- Category navigation is a bar of icon tabs plus icon tiles, not prose; a long list is cut to a preview with "show all".
- Search is the one prominent control and stays visible while scrolling.
- Listings are cards with photo and price first, place, and one contact action. Same card everywhere.
- Featured listings lead the list of the type the visitor opened (at most two), not side columns.
- Density over decoration: no long intro paragraphs, stats as a quiet line, no empty ad space.
- Use the platform's own art in `web/public/promo/*.webp` instead of plain icon-and-text sections.
- Reserve space for anything that loads late (watch layout shift).

Definition of done: typecheck, lint and tests green; the page checked at 1440 px and 390 px, in Arabic (RTL) and once in dark
mode; no horizontal overflow; the change recorded under the page's item in `docs/react-migration/PLAN.md`.

---
name: page-design
description: Design guidance for public marketplace-style pages of the PSM map (search, listings, category browsing, featured content) — layout patterns that work for classifieds / directory sites, and this project's visual rules. Use before redesigning or restyling any page the user calls ugly, cluttered or "not liked".
---

# Designing a page here

Process: **look first** (`ui-verify`), compare with the old page when the user points at it (`legacy-compare`), change one
thing at a time, look again. The user judges by eye, in Arabic, mostly on phones — a page that passes tests can still be "not liked".

## Patterns (classifieds / directory sites: OpenSooq, Haraj, Dubizzle, OLX, Yelp)

- **Category navigation is a bar of icon tabs + icon tiles**, not prose. Few groups in the bar, types as tiles under it;
  a long "all" is cut to a preview with "show all" (OLX / Dubizzle keep every category one tap away).
- **Search is the one prominent control** and stays visible while scrolling; quick actions (map, live status) are chips beside it.
- **Listings are cards with a photo/price first**: image or icon, price, place, one contact action. Same card everywhere.
- **Paid placements in context, not in side columns.** Featured listings of the type the visitor opened lead its list (at
  most two, rotating per visit) with the featured frame; side "ad" columns were tried here and removed (banner blindness,
  a narrow page, off-topic ads).
- **Density over decoration**: no intro paragraphs longer than one line; stats as a quiet line, not tiles; no empty "ad space".
- Filters: always reachable, one row where possible, behind a button on phones; results say how many, allow sort.

## Lessons from `/search` (three passes)

- **Use the platform's own art.** `web/public/promo/*.webp` are isometric illustrations per section (property, maintenance,
  health, vehicles, events, professions, parks, schools). Pages built from icons and text alone were rejected as plain;
  the version with these pictures (hero, section mosaic, placeholders for listings without photos) was the one kept.
  Crop them to the drawing side (`object-left-bottom`): the banners carry printed Arabic headings.
- Improving the legacy layout is not a design idea; neither is promoting a niche feature (live road / fuel status) to
  the top. Lead with the main need (find a service or a property) and make it feel premium: big type, generous space,
  pictures, soft motion, one strong search.
- Measure layout shift (CLS) while loading, not only the final screenshot: reserve space for anything that arrives late.

## Project rules

- Tokens and components first: `web/src/index.css` (legacy design-system tokens), `web/src/components/ui/`, HOUSE-STYLE.md.
- Tailwind logical classes only (`ms-`, `pe-`, `start-`…); direction-sensitive icons `rtl:rotate-*`.
- Text ≥ 14 px; touch targets ≥ 40 px; visible focus (`focus-visible:outline-2 focus-visible:outline-brand`).
- All strings in `locales/ar.json` **and** `en.json`; delete keys you stop using (`i18nKeys.test.ts` guards this).
- Cards: `search/ListingCard` is the compact teaser (picture first, one action row) for landings, columns and rows;
  the map's `FeaturedCard` is the full detail card for result lists. Do not invent a third. Media go through
  `components/ui/MediaGallery` (strip) and its `MediaViewer` (lightbox); thumbnails through `components/ui/media.tsx`.
- A card inside a horizontally scrolled row must be `relative`: `sr-only` spans are absolutely positioned and otherwise
  stretch the document (see `ui-verify`).
- Record each deliberate UX change under the page's PLAN item ("Changed on purpose").

## Definition of done for a visual change

typecheck + lint + tests green; screenshots at 1440 and 390 read and judged; no horizontal overflow; PLAN.md updated.

import type { TypeGroupId } from '../map/registry';

// The platform's own isometric illustrations (web/public/promo, also the welcome slideshow) put to work on the search page.

const promo = (n: number) => `/promo/${String(n).padStart(2, '0')}.webp`;

/** Cover picture of a section card. Sections without one get an icon card. */
export const GROUP_ART: Partial<Record<TypeGroupId, string>> = {
  realestate: promo(12),
  technicians: promo(8),
  health: promo(11),
  vehicles: promo(9),
  events: promo(10),
  professional: promo(13),
  landmarks: promo(14),
  education: promo(3),
};


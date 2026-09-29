/**
 * Which featured listings to show, and in what order: the tiers are given best first (featured, then recommended),
 * every tier is shuffled so equally-rated advertisers take turns from one visit to the next, and the lower tier only
 * fills what the higher one leaves free. Pure: the randomness comes from `random`.
 */
export function featuredOrder<T>(tiers: T[][], random: () => number, limit: number): T[] {
  const out: T[] = [];
  for (const tier of tiers) {
    const copy = [...tier];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    out.push(...copy);
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/** Small seeded generator (mulberry32) so a page load has one stable order while the cards re-render. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

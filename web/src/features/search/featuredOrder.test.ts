import { describe, expect, it } from 'vitest';
import type { SearchResult } from '../map/search/results';
import { pinFeatured } from './sort';
import { featuredOrder, seededRandom } from './featuredOrder';

describe('featuredOrder', () => {
  it('lists the better tier first and only fills up from the next one', () => {
    const out = featuredOrder([['f1', 'f2'], ['r1', 'r2', 'r3']], seededRandom(1), 4);
    expect(out.slice(0, 2).sort()).toEqual(['f1', 'f2']);
    expect(out).toHaveLength(4);
    expect(out.slice(2).every((x) => x.startsWith('r'))).toBe(true);
  });

  it('never reaches the lower tier when the higher one is enough', () => {
    expect(featuredOrder([['a', 'b', 'c'], ['x']], seededRandom(7), 2).every((x) => 'abc'.includes(x))).toBe(true);
  });

  it('rotates equal advertisers between visits but is stable for one seed', () => {
    const pool = [Array.from({ length: 12 }, (_, i) => `f${i}`)];
    const a = featuredOrder(pool, seededRandom(1), 4);
    expect(featuredOrder(pool, seededRandom(1), 4)).toEqual(a);
    expect(new Set([2, 3, 4, 5].map((s) => featuredOrder(pool, seededRandom(s), 4).join())).size).toBeGreaterThan(1);
  });

  it('does not change its input', () => {
    const tier = ['a', 'b', 'c'];
    featuredOrder([tier], seededRandom(3), 3);
    expect(tier).toEqual(['a', 'b', 'c']);
  });
});

describe('pinFeatured', () => {
  const row = (key: string, rating: number) => ({ key, rating }) as unknown as SearchResult;
  const list = [row('a', 9), row('f1', 10), row('b', 5), row('f2', 10), row('f3', 10)];

  it('puts at most two featured rows first and keeps the rest in the given order', () => {
    const { pinned, rest } = pinFeatured(list, seededRandom(1));
    expect(pinned).toHaveLength(2);
    expect(pinned.every((r) => r.rating === 10)).toBe(true);
    expect(rest.map((r) => r.key).filter((k) => !k.startsWith('f'))).toEqual(['a', 'b']);
    expect(pinned.length + rest.length).toBe(list.length);
  });

  it('pins nothing when the list has no featured row', () => {
    expect(pinFeatured([row('a', 9), row('b', 1)], seededRandom(1)).pinned).toEqual([]);
  });

  it('lets the featured advertisers take turns between visits', () => {
    const firsts = new Set([1, 2, 3, 4, 5, 6].map((s) => pinFeatured(list, seededRandom(s)).pinned[0].key));
    expect(firsts.size).toBeGreaterThan(1);
  });
});

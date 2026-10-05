import { useMemo } from 'react';
import type { SearchResult } from '../search/results';
import type { Props } from '../popup/featureModel';
import {
  FEATURED_RATING,
  RECOMMENDED_RATING,
  hasPhotos,
  hasVideos,
  type FeaturedEntry,
} from './featured';
import { useRatedFeatures, useTopRatedFeatures } from './queries';

export interface FeaturedRow {
  /** null while loading. */
  entries: FeaturedEntry[] | null;
  failed: boolean;
}

export interface FeaturedRows {
  featured: FeaturedRow;
  topRated: FeaturedRow;
  recommended: FeaturedRow;
  photos: FeaturedRow;
  videos: FeaturedRow;
  /** Every source failed: one error instead of six. */
  allFailed: boolean;
}

/**
 * The data of the featured portal's sections, shared by the map's Extras panel and the /search landing.
 * `orderFeatured` reorders the featured listings (the landing lets equal advertisers take turns).
 */
export function useFeaturedRows(orderFeatured?: (rows: SearchResult[]) => SearchResult[]): FeaturedRows {
  const featured = useRatedFeatures(FEATURED_RATING);
  const recommended = useRatedFeatures(RECOMMENDED_RATING);
  const topRated = useTopRatedFeatures();

  const featuredEntries = useMemo(
    () =>
      featured.data
        ? (orderFeatured ? orderFeatured(featured.data) : featured.data).map((r) => ({ r }))
        : null,
    [featured.data, orderFeatured],
  );
  const recommendedEntries = useMemo(() => recommended.data?.map((r) => ({ r })) ?? null, [recommended.data]);

  // Photos and videos draw from both rating tiers (legacy); a tier that failed counts as empty.
  const poolLoading = featured.isPending || recommended.isPending;
  const pool = useMemo(
    () => (poolLoading ? null : [...(featuredEntries ?? []), ...(recommendedEntries ?? [])]),
    [poolLoading, featuredEntries, recommendedEntries],
  );
  const poolFailed = featured.isError && recommended.isError;
  const fromPool = (has: (p: Props) => boolean) => pool && pool.filter((e) => has(e.r.props));

  return {
    featured: { entries: featuredEntries, failed: featured.isError },
    topRated: { entries: topRated.data ?? null, failed: topRated.isError },
    recommended: { entries: recommendedEntries, failed: recommended.isError },
    photos: { entries: fromPool(hasPhotos), failed: poolFailed },
    videos: { entries: fromPool(hasVideos), failed: poolFailed },
    allFailed: poolFailed && topRated.isError,
  };
}

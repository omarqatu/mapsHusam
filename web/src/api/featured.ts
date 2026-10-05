import { api } from './client';

// Featured services portal (legacy featured-services-portal.js). The rating queries and the batch fetch reuse
// `searchApi` (search.ts); this file only holds the ranking endpoint.

export interface TopRatedItem {
  service_layer: string;
  feature_id: number | string;
  /** ROUND(AVG(rating), 1) — Postgres numeric, so it may arrive as a string. */
  avg_rating: number | string;
  total_ratings: number | string;
}

/** One listing's real ratings (GET /api/service-ratings-summary, one service type at a time). Postgres numerics may arrive as strings. */
export interface RatingsSummaryItem {
  feature_id: number | string;
  avg_rating: number | string;
  total_ratings: number | string;
}

export const featuredApi = {
  /** The real ratings of ONE service type grouped by listing — average and count only. Public. */
  ratingsSummary: (serviceLayer: string, signal?: AbortSignal) =>
    api.get<{ success: boolean; items: RatingsSummaryItem[] }>(
      '/api/service-ratings-summary',
      { service_layer: serviceLayer },
      { signal },
    ),
  /** Providers ranked by REAL ratings from completed service requests (not the manual `rating` column). Public. */
  topRated: (limit = 15) =>
    api.get<{ success: boolean; items: TopRatedItem[] }>('/api/top-rated-providers', { limit }),
};

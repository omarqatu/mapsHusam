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

export const featuredApi = {
  /** Providers ranked by REAL ratings from completed service requests (not the manual `rating` column). Public. */
  topRated: (limit = 15) =>
    api.get<{ success: boolean; items: TopRatedItem[] }>('/api/top-rated-providers', { limit }),
};

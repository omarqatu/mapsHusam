import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

// "My listings": the signed-in account's own services and properties (server/routes/my-listings.js). Edits are
// published at once; the server takes the account from the token and checks it owns the listing.

export type ListingKind = 'service' | 'property';
/** 0 available · 1 unavailable for now · 2 withdrawn (lib/listing-rules.js). */
export type ListingState = 0 | 1 | 2;
export type Currency = 'ILS' | 'USD' | 'JOD';

export interface MyListing {
  /** Service discriminator, or `ApartRent` / `ApartSale` / `LandSale`. */
  layer: string;
  id: number;
  kind: ListingKind;
  name: string;
  des: string;
  phone: string;
  whatsapp: string;
  work_hours: string;
  price: number | null;
  currency: Currency | null;
  area: number | null;
  location: string;
  status: ListingState;
  /** 1 = outside its work hours / ended (computed by the database). */
  auto_status: number;
  end_date: string | null;
  /** Picture URLs, in order (uploaded ones and links the admin entered). */
  photos: string[];
  /** Palestine Grid metres; for a plot, a point inside it. */
  x: number | null;
  y: number | null;
  rating_avg: number | null;
  rating_count: number;
}

export interface ListingEdit {
  name?: string;
  des?: string;
  phone?: string;
  whatsapp?: string;
  work_hours?: string;
  price?: number | null;
  currency?: Currency;
  area?: number | null;
  status?: ListingState;
  x_coord?: number;
  y_coord?: number;
}

export const MAX_PHOTOS = 8;

export const myListingsKeys = { all: ['my-listings'] as const };

const path = (l: Pick<MyListing, 'layer' | 'id'>) =>
  `/api/my-listings/${encodeURIComponent(l.layer)}/${l.id}`;

export const myListingsApi = {
  list: () => api.get<{ success: true; listings: MyListing[] }>('/api/my-listings'),
  edit: (l: Pick<MyListing, 'layer' | 'id'>, body: ListingEdit) =>
    api.patch<{ success: true; listing: MyListing }>(path(l), body),
  upload: (l: Pick<MyListing, 'layer' | 'id'>, file: Blob) =>
    api.post<{ success: true; url: string; photos: string[] }>(`${path(l)}/photos`, file),
  setPhotos: (l: Pick<MyListing, 'layer' | 'id'>, photos: string[]) =>
    api.put<{ success: true; photos: string[] }>(`${path(l)}/photos`, { photos }),
};

export const useMyListings = (enabled = true) =>
  useQuery({
    queryKey: myListingsKeys.all,
    queryFn: () => myListingsApi.list().then((r) => r.listings),
    enabled,
  });

/** Puts a changed listing into the cached list (no refetch), and drops the map's / search's cached answers. */
function useApplyListing() {
  const qc = useQueryClient();
  return (layer: string, id: number, patch: Partial<MyListing>) => {
    qc.setQueryData<MyListing[]>(myListingsKeys.all, (list) =>
      list?.map((l) => (l.layer === layer && l.id === id ? { ...l, ...patch } : l)),
    );
    void qc.invalidateQueries({
      predicate: (q) => q.queryKey[0] !== myListingsKeys.all[0] && q.queryKey[0] !== 'platform-content',
    });
  };
}

export function useEditListing() {
  const apply = useApplyListing();
  return useMutation({
    mutationFn: (v: { listing: MyListing; body: ListingEdit }) => myListingsApi.edit(v.listing, v.body),
    onSuccess: (r) => apply(r.listing.layer, r.listing.id, r.listing),
  });
}

export function useUploadPhoto() {
  const apply = useApplyListing();
  return useMutation({
    mutationFn: (v: { listing: MyListing; file: Blob }) => myListingsApi.upload(v.listing, v.file),
    onSuccess: (r, v) => apply(v.listing.layer, v.listing.id, { photos: r.photos }),
  });
}

export function useSetPhotos() {
  const apply = useApplyListing();
  return useMutation({
    mutationFn: (v: { listing: MyListing; photos: string[] }) => myListingsApi.setPhotos(v.listing, v.photos),
    onSuccess: (r, v) => apply(v.listing.layer, v.listing.id, { photos: r.photos }),
  });
}

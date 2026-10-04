import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

// "Add my business": a user asks for a service to be put on the map, an admin approves or rejects it (server.js,
// `listing_submissions`). The server takes the user from the token; bodies never carry an id or a role.

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface SubmissionInput {
  layer: string;
  name: string;
  des?: string;
  phone: string;
  whatsapp?: string;
  work_hours?: string;
  price?: number | null;
  /** Flats only. */
  area?: number;
  currency?: 'ILS' | 'USD' | 'JOD';
  /** Palestine Grid metres (EPSG:28191). */
  x_coord: number;
  y_coord: number;
}

/** A row of `GET /api/listing-submissions/mine`. */
export interface MySubmission {
  id: number;
  layer: string;
  name: string;
  status: SubmissionStatus;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/** A row of `GET /api/admin/listing-submissions` (numbers arrive as strings from Postgres). */
export interface AdminSubmission {
  id: number;
  user_id: number;
  user_name: string | null;
  user_phone: string | null;
  layer: string;
  name: string;
  des: string | null;
  phone: string;
  whatsapp: string | null;
  work_hours: string | null;
  price: string | null;
  /** Flats only. */
  area: number | null;
  currency: 'ILS' | 'USD' | 'JOD' | null;
  x_coord: string;
  y_coord: string;
  status: SubmissionStatus;
  created_at: string;
}

/** What the admin may correct before publishing, plus the search keywords the client builds from the type registry. */
export interface ApproveInput {
  name?: string;
  des?: string;
  work_hours?: string;
  search_tags?: string;
  /** A corrected point (Palestine Grid metres); omitted = the one the person picked. */
  x_coord?: number;
  y_coord?: number;
}

export const submissionKeys = {
  layers: ['listing-submissions', 'layers'] as const,
  mine: ['listing-submissions', 'mine'] as const,
  admin: (status: SubmissionStatus) => ['listing-submissions', 'admin', status] as const,
};

export const listingSubmissionsApi = {
  layers: () => api.get<{ success: true; layers: string[] }>('/api/listing-submissions/layers'),
  mine: () => api.get<{ success: true; submissions: MySubmission[] }>('/api/listing-submissions/mine'),
  submit: (body: SubmissionInput) => api.post<{ success: true }>('/api/listing-submissions', body),
  cancel: (id: number) => api.delete<{ success: true }>(`/api/listing-submissions/${id}`),
  adminList: (status: SubmissionStatus) =>
    api.get<{ success: true; submissions: AdminSubmission[] }>('/api/admin/listing-submissions', { status }),
  approve: (id: number, body: ApproveInput) =>
    api.post<{ success: true; feature_id: number }>(`/api/admin/listing-submissions/${id}/approve`, body),
  reject: (id: number, reason: string) =>
    api.post<{ success: true }>(`/api/admin/listing-submissions/${id}/reject`, { reason }),
};

export const useSubmittableLayers = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: submissionKeys.layers,
    queryFn: () => listingSubmissionsApi.layers().then((r) => r.layers),
    staleTime: Infinity,
  });

export const useMySubmissions = (enabled = true) =>
  useQuery({
    queryKey: submissionKeys.mine,
    queryFn: () => listingSubmissionsApi.mine().then((r) => r.submissions),
    enabled,
  });

export function useSubmitListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: listingSubmissionsApi.submit,
    onSuccess: () => qc.invalidateQueries({ queryKey: submissionKeys.mine }),
  });
}

export function useCancelSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: listingSubmissionsApi.cancel,
    onSuccess: () => qc.invalidateQueries({ queryKey: submissionKeys.mine }),
  });
}

export const useAdminSubmissions = (status: SubmissionStatus) =>
  useQuery({
    queryKey: submissionKeys.admin(status),
    queryFn: () => listingSubmissionsApi.adminList(status).then((r) => r.submissions),
  });

/** Approve / reject: the pending list and the home page's "needs you" count both change. */
export function useReviewSubmission() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['listing-submissions'] });
  return {
    approve: useMutation({
      mutationFn: (v: { id: number; body: ApproveInput }) => listingSubmissionsApi.approve(v.id, v.body),
      onSuccess: done,
    }),
    reject: useMutation({
      mutationFn: (v: { id: number; reason: string }) => listingSubmissionsApi.reject(v.id, v.reason),
      onSuccess: done,
    }),
  };
}

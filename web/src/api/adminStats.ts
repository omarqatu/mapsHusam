import { api } from './client';

// Provider success statistics (legacy dashboard.html). Admin only.

/** A row of `GET /api/admin/provider-success-stats` (one service request / call / WhatsApp click). */
export interface SuccessStatRow {
  id: number;
  user_id: number | null;
  provider_user_id: number | null;
  service_layer: string | null;
  feature_id: number | null;
  provider_name: string | null;
  service_type: string | null;
  /** completed | cancelled | rejected | accepted | pending (free text in the DB). */
  status: string | null;
  /** call | whatsapp | service_request | null */
  contact_type: string | null;
  cancellation_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  username: string | null;
  requester_phone: string | null;
  provider_phone: string | null;
}

export const adminStatsApi = {
  list: () => api.get<{ success: true; stats: SuccessStatRow[] }>('/api/admin/provider-success-stats'),
  remove: (id: number) =>
    api.delete<{ success: true; message: string }>(
      `/api/admin/provider-success-stats/${encodeURIComponent(String(id))}`,
    ),
};

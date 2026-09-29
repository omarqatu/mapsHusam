import { api } from './client';

// Admin-editable platform content (server.js → `platform_content`): one row per key, the value is text the client
// interprets (legal texts are JSON `{title, html}`, settings are JSON too). Reads are public, writes need an admin.

export interface PlatformContentItem {
  content_key: string;
  label: string;
  content_value: string;
  updated_at: string;
}

export const platformContentApi = {
  /** GET /api/platform-content/:key — 404 (ApiError) when nobody has saved the key yet. */
  get: (key: string) =>
    api.get<{ success: boolean; item?: PlatformContentItem }>(
      `/api/platform-content/${encodeURIComponent(key)}`,
    ),
  /** PUT /api/admin/platform-content/:key — creates or replaces the row; `label` is the human name shown to admins. */
  save: (key: string, label: string, value: string) =>
    api.put<{ success: boolean; item?: PlatformContentItem }>(
      `/api/admin/platform-content/${encodeURIComponent(key)}`,
      { label, value },
    ),
};

export const platformContentKeys = {
  item: (key: string) => ['platform-content', key] as const,
};

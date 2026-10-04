import { api } from './client';

// The provider's own service: which feature the account is linked to, and the two things a provider may change on it
// (status + location). Shapes are read from the handlers in server.js (`/api/get-provider-service`,
// `/api/update-service-status`) — both need the Bearer token; the server takes the user from it, not from the body.

/** 0 = available (shown on the map and in search), 1 = busy (hidden). The server rejects anything else. */
export type ProviderStatus = 0 | 1;

export interface ProviderServiceRow {
  /** Clean service `discriminator` (`plumber`) or a real-estate layer name (`ApartRent`). */
  service_layer: string;
  feature_id: number;
  id: number;
  /** The feature row's status. */
  status: number | string | null;
  /** Palestine Grid metres. Postgres `numeric` → arrives as a string. */
  x_coord: number | string | null;
  y_coord: number | string | null;
}

export type ProviderServiceResponse =
  | {
      success: true;
      show_panel: true;
      /** `users.status`: 0 = active, anything else = frozen by an admin. */
      user_status: number | null;
      service: ProviderServiceRow;
    }
  | { success: false; show_panel?: false; message?: string; error?: string };

export interface UpdateStatusBody {
  /** Must equal the token's user id (403 otherwise). */
  user_id: number;
  service_layer: string;
  feature_id: number;
  status: ProviderStatus;
  /** Palestine Grid metres; both or none. Without them only the status changes. */
  x_coord?: number;
  y_coord?: number;
}

export interface UpdateStatusResponse {
  success: true;
  status: ProviderStatus;
  message?: string;
}

export const providerApi = {
  /** 200 with `success:false` when the account is not linked to a feature. */
  getService: () => api.get<ProviderServiceResponse>('/api/get-provider-service'),
  /** 400 bad status / missing fields · 403 not your feature · 404 feature row missing. */
  updateStatus: (body: UpdateStatusBody) => api.post<UpdateStatusResponse>('/api/update-service-status', body),
};

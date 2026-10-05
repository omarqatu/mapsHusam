import { api } from './client';

// "Services for this property" measurement (server: POST /api/property-services-events). One row per thing a person does
// on a property's card, so the funnel can be read per type and per property. Public: visitors are counted too.

export type PropertyServicesAction = 'view' | 'open' | 'contact' | 'request';

export interface PropertyServicesEvent {
  action: PropertyServicesAction;
  /** The property's layer as the server names it (`LandSale`…) and its id. */
  property_layer: string;
  property_id: string;
  /** A service type key (`land_surveyors`) — required for open / contact / request. */
  service_type?: string;
  /** The provider's feature id — required for contact / request. */
  provider_id?: string;
  /** contact only. */
  channel?: 'call' | 'whatsapp';
  /** view only: how many types had somebody to offer. */
  types_offered?: number;
  /** A visitor's per-tab id; the server uses the account's id instead when the request carries a valid session. */
  visitor?: string;
}

export const propertyServicesApi = {
  track: (event: PropertyServicesEvent) => api.post<{ success: boolean }>('/api/property-services-events', event),
};

import type { APIRequestContext } from '@playwright/test';

/** A service provider from the dev GeoServer that the search box can find by its name alone. */
export interface KnownService {
  id: number;
  name: string;
}

interface ServiceFeature {
  properties: { id: number; name: string | null; phone: string | null; whatsapp: string | null };
}

/**
 * Reads the services layer (read-only WFS through the app's own /geoserver-proxy) and picks a provider with a
 * distinctive name and a phone or WhatsApp number, so the specs do not depend on any one hard-coded record. The name
 * must be unique among all services (a search for it cannot open somebody else's card).
 */
export async function pickService(request: APIRequestContext): Promise<KnownService> {
  const res = await request.get('/geoserver-proxy/services/ows', {
    params: {
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: 'services:service_all',
      outputFormat: 'application/json',
      maxFeatures: '2000',
    },
  });
  if (!res.ok()) throw new Error(`GeoServer (through the backend proxy) answered HTTP ${res.status()}`);
  const { features } = (await res.json()) as { features: ServiceFeature[] };

  const counts = new Map<string, number>();
  for (const f of features) {
    const n = f.properties.name?.trim();
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const found = features.find((f) => {
    const p = f.properties;
    const n = p.name?.trim() ?? '';
    return n.length >= 3 && counts.get(n) === 1 && (p.phone || p.whatsapp);
  });
  if (!found) throw new Error('The dev GeoServer has no service with a unique name and a phone / WhatsApp number');
  return { id: found.properties.id, name: found.properties.name!.trim() };
}

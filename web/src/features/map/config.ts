// Map configuration — typed port of legacy js/config.js (MAP_CONFIG) and js/layers.js.
// Names shown to users live in the locale files (services.<key>, layers.<key>); this file is data only.

export type Coordinate = [number, number];

/** Al-Manara square, Ramallah/Al-Bireh — legacy default start point. */
export const DEFAULT_CENTER: Coordinate = [169463.41, 145767.99];
export const DEFAULT_ZOOM = 19;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 22;
/** Legacy refreshed visible data layers every minute. */
export const REFRESH_INTERVAL_MS = 60_000;
/** Legacy: ignore GPS fixes arriving faster than this while tracking. */
export const GPS_MIN_INTERVAL_MS = 10_000;
export const WFS_TIMEOUT_MS = 15_000;

export type BasemapKey = 'esri' | 'osm' | 'aerial' | 'none';
export const BASEMAPS: BasemapKey[] = ['esri', 'osm', 'aerial', 'none'];
export const DEFAULT_BASEMAP: BasemapKey = 'esri';

export type RealEstateLayerKey = 'rent' | 'sale' | 'land';

export interface WfsLayerDef {
  key: string;
  workspace: 'realestate' | 'services';
  /** GeoServer feature type (must be whitelisted in server.js isValidLayer). */
  typeName: string;
  /** Hidden when the view resolution (m/px) is above this. */
  maxResolution: number;
  zIndex: number;
}

// Legacy helper layers (Governorate, City, Location, RoadsTest) are in MAP_CONFIG.globalExclusions and never
// shown, so they are not ported. Add them here if the exclusion is lifted.
export const REAL_ESTATE_LAYERS: (WfsLayerDef & { key: RealEstateLayerKey; icon: string })[] = [
  { key: 'rent', icon: '🏠', workspace: 'realestate', typeName: 'ApartRent', maxResolution: 1, zIndex: 20 },
  { key: 'sale', icon: '🏡', workspace: 'realestate', typeName: 'ApartSale', maxResolution: 1, zIndex: 20 },
  { key: 'land', icon: '🟥', workspace: 'realestate', typeName: 'LandSale', maxResolution: 1, zIndex: 10 },
];

/** One layer holds every service; `discriminator` tells the type (legacy "service_all"). */
export const SERVICE_ALL_LAYER: WfsLayerDef = {
  key: 'services',
  workspace: 'services',
  typeName: 'service_all',
  maxResolution: 5000,
  zIndex: 30,
};

export type ServiceTier = 'always' | 'medium' | 'close';

export interface ServiceType {
  key: string;
  icon: string;
  tier?: ServiceTier;
}

/** Every service type the map knows (legacy serviceTranslations). Unknown discriminators are not drawn. */
export const SERVICE_TYPES: ServiceType[] = [
  { key: 'fuel_stations', icon: '⛽', tier: 'always' },
  { key: 'road_barriers', icon: '🚧', tier: 'always' },
  { key: 'job_vacancies', icon: '💼', tier: 'always' },
  { key: 'schools_kindergartens', icon: '🏫', tier: 'medium' },
  { key: 'city_landmarks', icon: '🏛️', tier: 'medium' },
  { key: 'electrician', icon: '⚡' },
  { key: 'ac_technician', icon: '❄️' },
  { key: 'plumber', icon: '🔧' },
  { key: 'general_maintenance', icon: '🛠️' },
  { key: 'painter', icon: '🎨' },
  { key: 'Finisher', icon: '🛋️' },
  { key: 'carpenter', icon: '🪵' },
  { key: 'blacksmith', icon: '🔨' },
  { key: 'builder', icon: '🧱' },
  { key: 'house_cleaner', icon: '🧹' },
  { key: 'aluminum_tech', icon: '🪟' },
  { key: 'glass_tech', icon: '🛡️' },
  { key: 'car_mechanic', icon: '🚗' },
  { key: 'car_electrician', icon: '🔌' },
  { key: 'tire_tech', icon: '🛞' },
  { key: 'car_wash', icon: '🧼' },
  { key: 'motorcycle_repair', icon: '🏍️' },
  { key: 'taxi_driver', icon: '🚕' },
  { key: 'delivery_services', icon: '📦' },
  { key: 'tow_truck', icon: '🛻' },
  { key: 'cctv_installer', icon: '📹' },
  { key: 'party_planner', icon: '🎈' },
  { key: 'zaffa_bands', icon: '🥁' },
  { key: 'music_bands', icon: '🎸' },
  { key: 'party_rental', icon: '🎪' },
  { key: 'home_nurse', icon: '🩺' },
  { key: 'masseur', icon: '💆' },
  { key: 'cupping_specialist', icon: '🍵' },
  { key: 'nutritionist', icon: '🥗' },
  { key: 'truck_driver', icon: '🚛' },
  { key: 'security_firms', icon: '🛡️' },
  { key: 'furniture_buyer', icon: '🛋️' },
  { key: 'gardener', icon: '🌿' },
  { key: 'pet_care', icon: '🐾' },
  { key: 'clown_entertainer', icon: '🤡' },
  { key: 'online_stores', icon: '🛒' },
  { key: 'villas_rent', icon: '🏡' },
  { key: 'martial_arts_gymnastics', icon: '🥋' },
  { key: 'public_parks_recreation', icon: '🌳' },
  { key: 'hotels', icon: '🏨' },
  { key: 'free_distribution', icon: '🎁' },
  { key: 'barber_shop', icon: '💈' },
  { key: 'photographers', icon: '📷' },
  { key: 'video_design_ads', icon: '🎬' },
  { key: 'pharmacies_on_call', icon: '💊' },
  { key: 'taxis_on_call', icon: '🚕' },
  { key: 'emergency_hospitals', icon: '🏥' },
  { key: 'clinics', icon: '🩺' },
  { key: 'doctors_on_call', icon: '👨‍⚕️' },
  { key: 'ambulances_on_call', icon: '🚑' },
  { key: 'music_training', icon: '🎹' },
  { key: 'lawyers', icon: '⚖️' },
  { key: 'land_surveyors', icon: '📐' },
  { key: 'real_estate_valuers', icon: '📊' },
  { key: 'private_tutors', icon: '👨‍🏫' },
  { key: 'programmers', icon: '💻' },
  { key: 'car_delivery_on_call', icon: '🚗' },
  { key: 'motorcycle_delivery_on_call', icon: '🏍️' },
  { key: 'bicycle_delivery_on_call', icon: '🚲' },
  { key: 'student_research_assist', icon: '📚' },
  { key: 'supermarket', icon: '🏪' },
  { key: 'commercial_shops', icon: '🏬' },
  { key: 'restaurants', icon: '🍽️' },
];

export const SERVICE_TYPE_BY_KEY: ReadonlyMap<string, ServiceType> = new Map(
  SERVICE_TYPES.map((s) => [s.key, s]),
);

/** Per tier: max resolution at which the point is drawn, and below which its label is drawn (legacy values). */
export const TIER_RULES: Record<ServiceTier, { maxResolution: number; labelBelow: number }> = {
  always: { maxResolution: 5000, labelBelow: 8 },
  medium: { maxResolution: 5, labelBelow: 0.7 },
  close: { maxResolution: 1, labelBelow: 0.7 },
};

/** `stop` column of road_barriers → status (legacy getRoadBarrierStopInfo). Label text is `roadStatus.<key>`. */
export const ROAD_BARRIER_STATUS: Record<number, { key: string; color: string; icon: string }> = {
  0: { key: 'open', color: '#28a745', icon: '🟢' },
  1: { key: 'closed', color: '#dc3545', icon: '🔴' },
  2: { key: 'light', color: '#f39c12', icon: '🟠' },
  3: { key: 'heavy', color: '#8b0000', icon: '🟤' },
  4: { key: 'inspection', color: '#6f42c1', icon: '🟣' },
};
export const ROAD_BARRIER_UNKNOWN = { key: 'unknown', color: '#6c757d', icon: '⚪' };

export function roadBarrierStatus(stop: unknown) {
  const n = typeof stop === 'number' ? stop : Number.parseInt(String(stop), 10);
  return ROAD_BARRIER_STATUS[n] ?? ROAD_BARRIER_UNKNOWN;
}

/** Fuel availability columns of fuel_stations: 0 = available, anything else = not available. */
export const FUEL_FIELDS = ['diesel', 'banzen95', 'banzen98'] as const;
export type FuelField = (typeof FUEL_FIELDS)[number];

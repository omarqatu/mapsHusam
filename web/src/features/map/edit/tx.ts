import type { GeometryData } from './geometry';
import type { Props } from './attributes';

/**
 * One change to one feature, as plain data — the contract between the editor UI and the transport. It says WHAT to
 * write (table, row, values, shape in EPSG:28191), never HOW; nothing in it is WFS-specific except `credentials`.
 */
export interface FeatureTx {
  op: 'insert' | 'update' | 'delete';
  layer: { workspace: string; typeName: string };
  /** Full feature id (`service_all.12`); required for update and delete. */
  fid?: string;
  /** Insert only: columns in the order the table stores them (`geom` marks where the shape goes). */
  columns?: readonly string[];
  /** Values to write. Update: `null` clears the column. Insert: `null` / empty are left out. */
  properties: Props;
  /** Insert and update. */
  geometry?: GeometryData;
  /**
   * GeoServer login typed by the admin for THIS call. Held in memory only, by the dialog that collects it; it is
   * meaningless (and dropped) once the transport becomes a server endpoint that authenticates with the app session.
   */
  credentials?: { username: string; password: string };
}

export type SaveResult =
  | { ok: true; /** Insert: the id the database gave the new row. */ fid?: string }
  | { ok: false; reason: 'auth' | 'rejected' | 'network'; message?: string };

/**
 * `LandSale.12` / `12` / 12 -> `LandSale.12`. `null` when there is no id, or when the id belongs to another table
 * (deleting `service_all.5` through a `LandSale` filter would be a silent no-op at best).
 */
export function featureFid(typeName: string, id: string | number | null | undefined): string | null {
  if (id === null || id === undefined || String(id).trim() === '') return null;
  const s = String(id).trim();
  const dot = s.lastIndexOf('.');
  if (dot < 0) return `${typeName}.${s}`;
  const prefix = s.slice(0, dot);
  const n = s.slice(dot + 1);
  return prefix === typeName && n !== '' ? s : null;
}

import { PALESTINE_GRID } from '../projection';
import type { PropValue } from './attributes';
import type { GeometryData, Position } from './geometry';
import type { FeatureTx } from './tx';

// WFS 1.1.0 Transaction XML — the wire format behind `transport.ts`. Pure string building and parsing, so it is
// unit-tested without a browser or a server. Ported from the three legacy `sendWFS_T` functions, with one builder
// instead of three copies.

/** Namespace of each workspace as GeoServer publishes it (the real one; `dev/geoserver-setup.sh` aligns the local one). */
export function namespaceOf(workspace: string) {
  return `http://localhost/${workspace}`;
}

// XML 1.0 forbids most control characters even as entities; user text may contain them (paste from Word, PDFs).
// eslint-disable-next-line no-control-regex
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(value: unknown): string {
  return String(value)
    .replace(XML_INVALID, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const coord = ([x, y]: Position) => `${x},${y}`;

function polygonGml(rings: Position[][]): string {
  const body = rings
    .map((ring, i) => {
      const tag = i === 0 ? 'gml:exterior' : 'gml:interior';
      return `<${tag}><gml:LinearRing><gml:coordinates decimal="." cs="," ts=" ">${ring.map(coord).join(' ')}</gml:coordinates></gml:LinearRing></${tag}>`;
    })
    .join('');
  return `<gml:Polygon srsName="${PALESTINE_GRID}">${body}</gml:Polygon>`;
}

export function geometryGml(g: GeometryData): string {
  switch (g.type) {
    case 'Point':
      return `<gml:Point srsName="${PALESTINE_GRID}"><gml:coordinates>${coord(g.coordinates)}</gml:coordinates></gml:Point>`;
    case 'MultiLineString': {
      const members = g.coordinates
        .map(
          (line) =>
            `<gml:lineStringMember><gml:LineString srsName="${PALESTINE_GRID}"><gml:posList>${line
              .map(([x, y]) => `${x} ${y}`)
              .join(' ')}</gml:posList></gml:LineString></gml:lineStringMember>`,
        )
        .join('');
      return `<gml:MultiLineString srsName="${PALESTINE_GRID}">${members}</gml:MultiLineString>`;
    }
    case 'Polygon':
      return polygonGml(g.coordinates);
    case 'MultiPolygon':
      return `<gml:MultiPolygon srsName="${PALESTINE_GRID}">${g.coordinates
        .map((rings) => `<gml:polygonMember>${polygonGml(rings)}</gml:polygonMember>`)
        .join('')}</gml:MultiPolygon>`;
  }
}

const isBlank = (v: PropValue | undefined): v is null | undefined | '' =>
  v === null || v === undefined || String(v).trim() === '';

/** Ratings are stored with one decimal (legacy). */
function valueText(column: string, v: string | number): string {
  return column === 'rating' && Number.isFinite(Number(v)) ? Number(v).toFixed(1) : String(v);
}

const idFilter = (fid: string) => `<ogc:Filter><ogc:FeatureId fid="${escapeXml(fid)}"/></ogc:Filter>`;

function operationXml(tx: FeatureTx): string {
  const { workspace, typeName } = tx.layer;
  const name = `${workspace}:${typeName}`;
  const ns = `xmlns:${workspace}="${namespaceOf(workspace)}"`;

  if (tx.op === 'delete') {
    if (!tx.fid) throw new Error('delete needs a feature id');
    return `<wfs:Delete typeName="${name}" ${ns}>${idFilter(tx.fid)}</wfs:Delete>`;
  }
  if (!tx.geometry) throw new Error(`${tx.op} needs a geometry`);

  if (tx.op === 'insert') {
    let fields = '';
    for (const column of tx.columns ?? []) {
      if (column === 'geom') {
        fields += `<${workspace}:geom>${geometryGml(tx.geometry)}</${workspace}:geom>`;
        continue;
      }
      const v = tx.properties[column];
      if (isBlank(v)) continue;
      fields += `<${workspace}:${column}>${escapeXml(valueText(column, v))}</${workspace}:${column}>`;
    }
    return `<wfs:Insert><${name} ${ns}>${fields}</${name}></wfs:Insert>`;
  }

  if (!tx.fid) throw new Error('update needs a feature id');
  let props = '';
  for (const [column, v] of Object.entries(tx.properties)) {
    if (v === undefined) continue;
    const nameTag = `<wfs:Name>${workspace}:${column}</wfs:Name>`;
    // No <wfs:Value> = set the column to NULL (WFS 1.1.0 §"Update").
    props +=
      v === null || String(v).trim() === ''
        ? `<wfs:Property>${nameTag}</wfs:Property>`
        : `<wfs:Property>${nameTag}<wfs:Value>${escapeXml(valueText(column, v))}</wfs:Value></wfs:Property>`;
  }
  props += `<wfs:Property><wfs:Name>${workspace}:geom</wfs:Name><wfs:Value>${geometryGml(tx.geometry)}</wfs:Value></wfs:Property>`;
  return `<wfs:Update typeName="${name}" ${ns}>${props}${idFilter(tx.fid)}</wfs:Update>`;
}

/** The complete request body. Throws for a tx that lacks what its operation needs (a programming error). */
export function buildTransactionXml(tx: FeatureTx): string {
  const { workspace } = tx.layer;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" ` +
    `xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:${workspace}="${namespaceOf(workspace)}" ` +
    `xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">` +
    operationXml(tx) +
    `</wfs:Transaction>`
  );
}

// --- response ------------------------------------------------------------------------------------

export type TransactionOutcome =
  | { kind: 'done'; inserted: number; updated: number; deleted: number; fid?: string }
  | { kind: 'exception'; message: string };

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const count = (xml: string, tag: string) => {
  const m = new RegExp(`<(?:\\w+:)?${tag}>\\s*(\\d+)\\s*<`).exec(xml);
  return m ? Number(m[1]) : 0;
};

/**
 * Reads a WFS 1.1.0 Transaction response. GeoServer reports failures as an `ExceptionReport` (often with HTTP 200),
 * so a substring test for "Exception" — the legacy check — would also fire on a saved value containing that word.
 * Regular expressions instead of a DOM parser so it runs in the browser, jsdom and node alike.
 */
export function parseTransactionResponse(xml: string): TransactionOutcome {
  if (/<(?:\w+:)?(?:ExceptionReport|ServiceExceptionReport)\b/.test(xml)) {
    const text =
      /<(?:\w+:)?(?:ExceptionText|ServiceException)\b[^>]*>([\s\S]*?)<\/(?:\w+:)?(?:ExceptionText|ServiceException)>/.exec(
        xml,
      );
    return { kind: 'exception', message: text ? decodeEntities(text[1]).trim() : '' };
  }
  if (!/<(?:\w+:)?TransactionResponse\b/.test(xml)) return { kind: 'exception', message: '' };
  const fid = /<(?:\w+:)?InsertResults>[\s\S]*?<(?:\w+:)?FeatureId\b[^>]*\bfid="([^"]+)"/.exec(xml);
  return {
    kind: 'done',
    inserted: count(xml, 'totalInserted'),
    updated: count(xml, 'totalUpdated'),
    deleted: count(xml, 'totalDeleted'),
    // A table whose id sequence GeoServer cannot see answers `ApartRent.null`: the row exists, its id is just unknown.
    fid: fid && !/\.null$/.test(fid[1]) ? decodeEntities(fid[1]) : undefined,
  };
}

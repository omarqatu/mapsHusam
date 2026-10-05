import type { FeatureLike } from 'ol/Feature';
import { Circle, Fill, Icon, Stroke, Style, Text } from 'ol/style';
import { SERVICE_TYPE_BY_KEY, TIER_RULES, worstBarrierStatus, type RealEstateLayerKey } from './config';
import type { ServiceGroupId } from './registry';
import { iconElements } from './iconSvg';
import { serviceTypeIcon } from './registry/typeIcons';
import { INSERT_DEFAULTS } from './edit/attributes';

// Port of legacy js/layers.js createStyle + per-layer styles. Style objects that don't depend on the feature
// (icons, fills, strokes) are built once and reused; legacy rebuilt them for every feature on every frame.

const LABEL_FONT = 'bold 14px "Segoe UI", Arial, sans-serif';
const labelFill = new Fill({ color: '#333' });
const labelStroke = new Stroke({ color: 'rgba(255, 255, 255, 0.9)', width: 2 });

export type Translate = (key: string) => string;

function label(text: string, withIcon: boolean, line = false) {
  return new Text({
    text,
    font: LABEL_FONT,
    fill: labelFill,
    stroke: labelStroke,
    overflow: true,
    offsetY: withIcon ? -25 : -10,
    placement: line ? 'line' : 'point',
  });
}

/** Area values get the unit appended (legacy: any label field named like "area"). */
export function formatLabel(field: string, value: unknown, t: Translate): string {
  if (value === undefined || value === null || value === '') return '';
  const s = String(value);
  // "0 م²" is a missing area, not information — and it crowds the map (legacy drew it).
  if (field.toLowerCase().includes('area') && Number(s) === 0) return '';
  return field.toLowerCase().includes('area') ? `${s} ${t('map.areaUnit')}` : s;
}

// --- type markers ---------------------------------------------------------------------------
/** One colour per type group, so a kind of service can be found by colour from afar (kept mid-dark: the ring must show on imagery). */
export const GROUP_COLOR: Record<ServiceGroupId, string> = {
  roads: '#e65100',
  fuel: '#f59e0b',
  technicians: '#2563eb',
  health: '#dc2626',
  vehicles: '#0891b2',
  professional: '#7c3aed',
  events: '#db2777',
  misc: '#64748b',
  landmarks: '#0d9488',
  commercial: '#16a34a',
  education: '#ca8a04',
  jobs: '#4f46e5',
};

const markerIcons = new Map<string, Icon>();

/**
 * A service type's marker: its icon from the icon library, drawn in its group's colour on a light disc tinted with that
 * colour and ringed by a thin line of it (a soft, glassy look that sits lighter on the imagery than a solid white disc with a
 * heavy border). `solid` = a filled disc with a white icon (a road checkpoint, whose colour IS its status). The drawing comes
 * from our own registry, never from feature data.
 */
export function typeMarker(typeKey: string, group: ServiceGroupId, color = '#3f51b5', solid = false): Icon {
  const key = `${typeKey}|${color}|${solid}`;
  let icon = markerIcons.get(key);
  if (!icon) {
    const drawing =
      `<g transform="translate(8.4 8.4) scale(0.8)" fill="none" stroke="${solid ? '#fff' : color}" stroke-width="2.2" ` +
      `stroke-linecap="round" stroke-linejoin="round">${iconElements(serviceTypeIcon(typeKey, group))}</g>`;
    const disc = solid
      ? `<circle cx="18" cy="18" r="16" fill="${color}" stroke="#fff" stroke-width="1.5"/>`
      : `<circle cx="18" cy="18" r="16" fill="white" fill-opacity="0.86" stroke="${color}" stroke-opacity="0.45" stroke-width="1"/>` +
        `<circle cx="18" cy="18" r="16" fill="${color}" fill-opacity="0.14"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">${disc}${drawing}</svg>`;
    icon = new Icon({
      anchor: [0.5, 0.5],
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      scale: 1,
      declutterMode: 'obstacle',
    });
    markerIcons.set(key, icon);
  }
  return icon;
}

// --- real estate -----------------------------------------------------------------------------
interface RealEstateStyleSpec {
  labelBelow: number;
  icon?: Icon;
  fill: Fill;
  stroke: Stroke;
  point?: Circle;
}

const reSpecs: Record<RealEstateLayerKey, RealEstateStyleSpec> = {
  rent: {
    labelBelow: 0.8,
    icon: new Icon({
      anchor: [0.5, 0.5],
      src: '/icons/rent_icon.png',
      scale: 0.12,
      declutterMode: 'obstacle',
    }),
    fill: new Fill({ color: 'rgba(255, 102, 0, 0.15)' }),
    stroke: new Stroke({ color: '#000', width: 2 }),
  },
  sale: {
    labelBelow: 0.8,
    icon: new Icon({
      anchor: [0.5, 0.5],
      src: '/icons/sale_icon.png',
      scale: 0.18,
      declutterMode: 'obstacle',
    }),
    fill: new Fill({ color: 'rgba(0, 128, 0, 0.15)' }),
    stroke: new Stroke({ color: '#000', width: 2 }),
  },
  land: {
    labelBelow: 1.2,
    fill: new Fill({ color: 'rgba(255, 0, 0, 0.15)' }),
    stroke: new Stroke({ color: 'red', width: 2 }),
    point: new Circle({
      radius: 7,
      fill: new Fill({ color: 'rgba(255, 0, 0, 1)' }),
      stroke: new Stroke({ color: 'red', width: 2 }),
      declutterMode: 'obstacle',
    }),
  },
};

export function realEstateStyle(key: RealEstateLayerKey, t: Translate) {
  const spec = reSpecs[key];
  const bare = new Style({ image: spec.icon ?? spec.point, fill: spec.fill, stroke: spec.stroke });
  return (feature: FeatureLike, resolution: number): Style => {
    if (resolution >= spec.labelBelow) return bare;
    const text = formatLabel('area', feature.get('area'), t);
    if (!text) return bare;
    const isLine = (feature.getGeometry()?.getType() ?? '').includes('Line');
    return new Style({
      image: spec.icon ?? spec.point,
      fill: spec.fill,
      stroke: spec.stroke,
      text: label(text, !!spec.icon, isLine),
    });
  };
}

// --- services (single service_all layer, typed by `discriminator`) ---------------------------
export interface ServiceStyleOptions {
  t: Translate;
  /** Types the user switched off in the layer panel. Read on every render, so a `layer.changed()` applies it. */
  isHidden: (discriminator: string) => boolean;
}

export function serviceStyle({ t, isHidden }: ServiceStyleOptions) {
  return (feature: FeatureLike, resolution: number): Style | undefined => {
    const discriminator = feature.get('discriminator');
    if (typeof discriminator !== 'string') return undefined;
    const type = SERVICE_TYPE_BY_KEY.get(discriminator);
    if (!type || isHidden(discriminator)) return undefined;

    const rule = TIER_RULES[type.tier ?? 'close'];
    if (resolution > rule.maxResolution) return undefined;

    let barrierColor: string | null = null;
    let text = '';
    if (resolution < rule.labelBelow) {
      const name = feature.get('name');
      text = typeof name === 'string' || typeof name === 'number' ? String(name) : '';
      // The placeholder every new service starts with says nothing and crowds the map.
      if (text.trim() === INSERT_DEFAULTS.name) text = '';
    }
    if (discriminator === 'road_barriers') {
      const status = worstBarrierStatus(feature.get('stop'), feature.get('stop2')); // the worse direction
      barrierColor = status.color;
      if (resolution < rule.labelBelow) {
        const statusText = t(`roadStatus.${status.key}`);
        text = text ? `${text} (${statusText})` : statusText;
      }
    }
    return new Style({
      image: barrierColor
        ? typeMarker(type.key, type.group, barrierColor, true)
        : typeMarker(type.key, type.group, GROUP_COLOR[type.group]),
      text: text ? label(text, true) : undefined,
    });
  };
}

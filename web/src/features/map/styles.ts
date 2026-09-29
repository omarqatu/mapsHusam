import type { FeatureLike } from 'ol/Feature';
import { Circle, Fill, Icon, Stroke, Style, Text } from 'ol/style';
import { roadBarrierStatus, SERVICE_TYPE_BY_KEY, TIER_RULES, type RealEstateLayerKey } from './config';

// Port of legacy js/layers.js createStyle + per-layer styles. Style objects that don't depend on the feature
// (icons, fills, strokes) are built once and reused; legacy rebuilt them for every feature on every frame.

const LABEL_FONT = 'bold 14px "Segoe UI", Arial, sans-serif';
const labelFill = new Fill({ color: '#333' });
const labelStroke = new Stroke({ color: '#ffffff', width: 3 });

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
  return field.toLowerCase().includes('area') ? `${s} ${t('map.areaUnit')}` : s;
}

// --- emoji markers ---------------------------------------------------------------------------
const emojiIcons = new Map<string, Icon>();

/** Emoji inside a white disc (legacy look). The emoji comes from our own config, never from feature data. */
export function emojiIcon(emoji: string): Icon {
  let icon = emojiIcons.get(emoji);
  if (!icon) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
      '<circle cx="16" cy="16" r="14" fill="white" stroke="#3f51b5" stroke-width="2"/>' +
      `<text x="16" y="23" font-size="20" font-family="Arial, sans-serif" text-anchor="middle">${emoji}</text></svg>`;
    icon = new Icon({
      anchor: [0.5, 0.5],
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      scale: 1,
      declutterMode: 'obstacle',
    });
    emojiIcons.set(emoji, icon);
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

    let icon = type.icon;
    let text = '';
    if (resolution < rule.labelBelow) {
      const name = feature.get('name');
      text = typeof name === 'string' || typeof name === 'number' ? String(name) : '';
    }
    if (discriminator === 'road_barriers') {
      const status = roadBarrierStatus(feature.get('stop'));
      icon = status.icon;
      if (resolution < rule.labelBelow) {
        const statusText = t(`roadStatus.${status.key}`);
        text = text ? `${text} (${statusText})` : statusText;
      }
    }
    return new Style({ image: emojiIcon(icon), text: text ? label(text, true) : undefined });
  };
}

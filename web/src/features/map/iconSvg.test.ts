import { describe, expect, it } from 'vitest';
import { Wrench } from 'lucide-react';
import { iconElements } from './iconSvg';
import { TYPE_ICON } from './registry/typeIcons';
import Feature from 'ol/Feature';
import { Icon } from 'ol/style';
import { realEstateStyle, typeMarker } from './styles';

// The map draws a marker from the icon library's own drawing. This reads it from the library's internals, so an upgrade
// that changes them must fail here and not leave the map drawing empty markers.
describe('icon drawings for the map', () => {
  it('turns a library icon into SVG elements', () => {
    const svg = iconElements(Wrench);
    expect(svg).toMatch(/^<path d="[^"]+"\/>/);
    expect(svg).not.toContain('key=');
  });
  it('every type has a drawing', () => {
    for (const [key, icon] of Object.entries(TYPE_ICON))
      expect(iconElements(icon).length, key).toBeGreaterThan(20);
  });
  it('a marker is an image of that drawing on a disc; a checkpoint is a solid disc with a white icon', () => {
    const decode = (src: string) => decodeURIComponent(src.replace('data:image/svg+xml;charset=utf-8,', ''));
    const plain = decode(typeMarker('plumber', 'technicians', '#2563eb').getSrc()!);
    expect(plain).toContain('<path');
    expect(plain).toContain('stroke="#2563eb"');
    expect(plain).not.toMatch(/<text/); // no emoji text
    const barrier = decode(typeMarker('road_barriers', 'roads', '#dc3545', true).getSrc()!);
    expect(barrier).toContain('fill="#dc3545"');
    expect(barrier).toContain('stroke="#fff"');
    expect(typeMarker('plumber', 'technicians', '#2563eb')).toBe(
      typeMarker('plumber', 'technicians', '#2563eb'),
    ); // cached
  });
  it('rent and sale markers are drawn icons on a solid disc, not pictures with English words', () => {
    const decode = (src: string) => decodeURIComponent(src.replace('data:image/svg+xml;charset=utf-8,', ''));
    const t = (k: string) => k;
    for (const [key, color] of [
      ['rent', '#ea580c'],
      ['sale', '#16a34a'],
    ] as const) {
      const image = realEstateStyle(key, t)(new Feature(), 10)?.getImage();
      expect(image).toBeInstanceOf(Icon);
      const src = (image as Icon).getSrc()!;
      expect(src.startsWith('data:image/svg+xml')).toBe(true);
      const svg = decode(src);
      expect(svg).toContain(`fill="${color}"`);
      expect(svg).toContain('<path');
      expect(svg).not.toMatch(/<text/);
    }
  });
});

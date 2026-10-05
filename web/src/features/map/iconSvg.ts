import type { LucideIcon } from 'lucide-react';

type IconNode = [tag: string, attrs: Record<string, string | number>][];

/**
 * The drawing of an icon from the library as SVG elements (no `<svg>` around them), for places that are not React: the map's
 * markers are images. lucide-react 1.x renders its icon as `<Icon icon={{ name, size, node }} />`; the node list is read from there. If a
 * library upgrade changes that, `iconSvg.test.ts` fails instead of the map drawing empty markers.
 */
export function iconElements(icon: LucideIcon): string {
  const rendered = (icon as unknown as { render: (props: object, ref: null) => { props: { icon?: IconNode | { node?: IconNode } } } }).render({}, null);
  const data = rendered.props.icon;
  const nodes = Array.isArray(data) ? data : data?.node;
  if (!Array.isArray(nodes)) throw new Error('icon has no drawing');
  return nodes
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
        .join(' ');
      return `<${tag} ${a}/>`;
    })
    .join('');
}

import { useMemo, type Ref } from 'react';
import QRCode from 'qrcode';

/** A QR code drawn as SVG squares (no HTML strings): sharp at any print size. Error correction M survives a scuffed sticker. */
export default function QrCode({
  text,
  label,
  ref,
}: {
  text: string;
  label: string;
  ref?: Ref<SVGSVGElement>;
}) {
  const { size, dark } = useMemo(() => {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const cells: [number, number][] = [];
    for (let y = 0; y < modules.size; y++)
      for (let x = 0; x < modules.size; x++) if (modules.get(x, y)) cells.push([x, y]);
    return { size: modules.size, dark: cells };
  }, [text]);
  const quiet = 4; // the blank margin scanners need
  const full = size + quiet * 2;
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${full} ${full}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="h-auto w-full"
    >
      <rect width={full} height={full} fill="#fff" />
      {dark.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x + quiet} y={y + quiet} width={1} height={1} fill="#000" />
      ))}
    </svg>
  );
}

/** Small filled circle in a status colour — replaces the 🟢🔴🟠⚪ emoji (they render differently on every OS). */
export default function StatusDot({ color, className = 'h-2.5 w-2.5' }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full ${className}`} style={{ backgroundColor: color }} />;
}

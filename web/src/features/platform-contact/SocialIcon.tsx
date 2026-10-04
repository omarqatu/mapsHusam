import type { ReactNode } from 'react';
import type { SocialKey } from './model';

/** lucide-react has no brand icons, so these are plain paths (currentColor, 24 × 24). */
const glyph = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
    {children}
  </svg>
);

const ICONS: Record<SocialKey, ReactNode> = {
  facebook: glyph(
    <path d="M13.5 22v-8.2h2.8l.5-3.3h-3.3V8.4c0-.9.4-1.7 1.8-1.7h1.6V3.9c-.3 0-1.3-.2-2.4-.2-2.5 0-4.1 1.5-4.1 4.2v2.6H7.6v3.3h2.8V22h3.1z" />,
  ),
  instagram: glyph(
    <path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM12 3.6c2.7 0 3 0 4.1.1 2.7.1 4 1.4 4.1 4.1.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c-.1 2.7-1.4 4-4.1 4.1-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-2.7-.1-4-1.4-4.1-4.1-.1-1.1-.1-1.4-.1-4.1s0-3 .1-4.1c.1-2.7 1.4-4 4.1-4.1 1.1-.1 1.4-.1 4.1-.1zM12 2c-2.7 0-3.1 0-4.1.1C4.2 2.3 2.3 4.2 2.1 7.9 2 8.9 2 9.3 2 12s0 3.1.1 4.1c.2 3.7 2.1 5.6 5.8 5.8 1 .1 1.4.1 4.1.1s3.1 0 4.1-.1c3.7-.2 5.6-2.1 5.8-5.8.1-1 .1-1.4.1-4.1s0-3.1-.1-4.1c-.2-3.7-2.1-5.6-5.8-5.8C15.1 2 14.7 2 12 2z" />,
  ),
  youtube: glyph(
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z" />,
  ),
  linkedin: glyph(
    <path d="M4.5 9h3.6v12H4.5zM6.3 3.2a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM10.2 9h3.4v1.6c.5-.9 1.7-1.9 3.5-1.9 3.6 0 4.3 2.4 4.3 5.4V21h-3.6v-6c0-1.4 0-3.2-2-3.2s-2.2 1.5-2.2 3.1V21h-3.6z" />,
  ),
};

export default function SocialIcon({ name }: { name: SocialKey }) {
  return <>{ICONS[name]}</>;
}

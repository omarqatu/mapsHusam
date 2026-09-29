import type { ReactNode } from 'react';
import clsx from 'clsx';
import { ExternalLink, ThumbsUp, Info, List, Video } from 'lucide-react';
import { Link } from 'react-router';
import type {
  LegalBlock,
  LegalCallout,
  LegalCard,
  LegalDoc,
  LegalIconName,
  LegalInline,
  LegalPanelBody,
  LegalTone,
} from './types';

const inlineIcons: Record<LegalIconName, typeof Info> = {
  info: Info,
  external: ExternalLink,
  list: List,
  video: Video,
  facebook: ThumbsUp,
};

const tones: Record<LegalTone, string> = {
  blue: 'border-info-line bg-info-soft text-info',
  yellow: 'border-warn-line bg-warn-soft text-warn',
  green: 'border-ok-line bg-ok-soft text-ok',
  gray: 'border-line bg-subtle text-fg',
  cyan: 'border-info-line bg-info-soft text-info',
};

const linkClass = 'font-semibold text-brand-fg underline';

function Inline({ parts }: { parts: LegalInline[] }) {
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === 'string') return <span key={i}>{p}</span>;
        if ('strong' in p) return <strong key={i}>{p.strong}</strong>;
        if ('icon' in p) {
          const Icon = inlineIcons[p.icon];
          return <Icon key={i} className="inline h-4 w-4 align-text-bottom" aria-hidden />;
        }
        return p.link.startsWith('/') ? (
          <Link key={i} to={p.link} className={linkClass}>
            {p.text}
          </Link>
        ) : (
          <a key={i} href={p.link} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {p.text}
          </a>
        );
      })}
    </>
  );
}

function ActionLink({ href, text, icon }: { href: string; text: string; icon?: LegalIconName }) {
  const Icon = icon ? inlineIcons[icon] : null;
  const cls =
    'mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-hover';
  const body = (
    <>
      {Icon && <Icon className="h-4 w-4" aria-hidden />}
      {text}
    </>
  );
  return href.startsWith('/') ? (
    <Link to={href} className={cls}>
      {body}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  );
}

function Callout({ block }: { block: LegalCallout }) {
  return (
    <p className={clsx('rounded-xl border p-3 text-sm leading-7', tones[block.tone])}>
      <Inline parts={block.text} />
    </p>
  );
}

function Card({ block }: { block: LegalCard }) {
  return (
    <div
      className="rounded-xl border border-line bg-surface p-3 ps-4 text-sm leading-7"
      style={{ borderInlineStartWidth: 4, borderInlineStartColor: block.accent }}
    >
      <h4 className="font-bold text-fg">{block.title}</h4>
      <p className="text-fg">
        <Inline parts={block.text} />
      </p>
      {block.action && <ActionLink {...block.action} />}
    </div>
  );
}

function PanelBody({ body }: { body: LegalPanelBody }) {
  switch (body.kind) {
    case 'text':
      return (
        <p className="text-sm leading-7">
          <Inline parts={body.text} />
        </p>
      );
    case 'list':
      return (
        <ul className="list-disc space-y-1.5 ps-5 text-sm leading-7">
          {body.items.map((item, i) => (
            <li key={i}>
              <Inline parts={item} />
            </li>
          ))}
        </ul>
      );
    case 'stats':
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {body.items.map((s) => (
            <div key={s.label} className="rounded-lg bg-surface/70 p-2 text-center">
              <div className="text-xl font-black">{s.value}</div>
              <div className="text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      );
    case 'button':
      return <ActionLink href={body.href} text={body.text} icon={body.icon} />;
  }
}

function Block({ block }: { block: LegalBlock }): ReactNode {
  switch (block.kind) {
    case 'title':
      return (
        <div className="text-center">
          <h3 className="text-xl font-black text-fg">{block.title}</h3>
          <p className="text-sm text-muted">{block.subtitle}</p>
        </div>
      );
    case 'intro':
      return (
        <p className="text-sm leading-7 text-fg">
          <Inline parts={block.text} />
        </p>
      );
    case 'callout':
      return <Callout block={block} />;
    case 'cards':
      return (
        <div className="space-y-2">
          {block.items.map((it, i) =>
            it.kind === 'card' ? <Card key={i} block={it} /> : <Callout key={i} block={it} />,
          )}
        </div>
      );
    case 'panel':
      return (
        <section className={clsx('space-y-2 rounded-xl border p-4', tones[block.tone])}>
          <h4 className="font-bold">{block.title}</h4>
          {block.body.map((b, i) => (
            <PanelBody key={i} body={b} />
          ))}
        </section>
      );
  }
}

/** Renders a structured legal/help document. Everything goes through JSX: no raw HTML. */
export default function LegalDocView({ doc }: { doc: LegalDoc }) {
  return (
    <div className="space-y-3">
      {doc.blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

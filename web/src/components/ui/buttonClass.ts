import clsx from 'clsx';

// The look of a button, shared by Button and ButtonLink.

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerSoft' | 'ghost' | 'whatsapp';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-subtle',
  danger: 'bg-danger-solid text-white hover:brightness-90',
  /** A delete that sits in every row of a table: visible as destructive without shouting. */
  dangerSoft: 'border border-danger-line bg-danger-soft text-danger hover:brightness-95',
  ghost: 'text-fg hover:bg-subtle',
  whatsapp: 'bg-whatsapp text-white hover:bg-whatsapp-hover',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-[3.25rem] px-5 text-base',
};

/** The classes of a button: also used by `ButtonLink` (a link that looks like one). */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return clsx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variants[variant],
    sizes[size],
    className,
  );
}

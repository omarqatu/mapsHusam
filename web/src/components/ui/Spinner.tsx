import clsx from 'clsx';

const sizes = { sm: 'h-5 w-5 border-2', md: 'h-8 w-8 border-[3px]', lg: 'h-12 w-12 border-4' } as const;

export function Spinner({ size = 'md', className }: { size?: keyof typeof sizes; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx('animate-spin rounded-full border-line border-t-brand', sizes[size], className)}
    />
  );
}

export function CenteredSpinner({
  minHeight = '14rem',
  size,
}: {
  minHeight?: string;
  size?: keyof typeof sizes;
}) {
  return (
    <div className="flex items-center justify-center" style={{ minHeight }}>
      <Spinner size={size} />
    </div>
  );
}

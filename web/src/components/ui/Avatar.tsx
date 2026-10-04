import clsx from 'clsx';

/** The user's round mark: the first letter (accounts carry no photo); `skin` = its colours, the brand gradient by default. */
export default function Avatar({
  name,
  className,
  skin = 'bg-gradient-to-br from-brand to-brand-2 text-white shadow-card',
}: {
  name: string;
  className: string;
  skin?: string;
}) {
  return (
    <span
      aria-hidden
      className={clsx('flex shrink-0 items-center justify-center rounded-full font-black', skin, className)}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

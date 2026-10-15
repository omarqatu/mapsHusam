import clsx from 'clsx';

/**
 * The Nitaq logo: the letter «ن» drawn as an isometric block of land parcels, on its navy tile. A picture cut from the
 * owner's brand board (the same one the app icons in `public/icons` are made from), so the tile rounds with the class.
 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/icons/nitaq-mark-144.png"
      alt=""
      aria-hidden
      draggable={false}
      className={clsx('shrink-0 rounded-xl object-cover', className)}
    />
  );
}

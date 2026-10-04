import { Play } from 'lucide-react';

// Bits shared by the media strip (MediaGallery) and the cards that show one thumbnail (search ListingCard).

export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
export const ytWatch = (id: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** Overlay on a video thumbnail. */
export const playBadge = (
  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
    <span className="rounded-full bg-black/60 p-2 text-white">
      <Play className="h-5 w-5 fill-current" aria-hidden />
    </span>
  </span>
);

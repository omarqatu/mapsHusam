// A picture from the phone's camera is several MB; the map shows it at most a few hundred pixels wide. Shrink it in
// the browser before upload: longest side ≤ 1600 px, JPEG (WebP kept as is when already small).

const MAX_SIDE = 1600;
const QUALITY = 0.82;
/** Small enough to send untouched (and keep a PNG's transparency). */
const KEEP_BELOW = 400 * 1024;

export class ImageError extends Error {}

export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new ImageError('not an image');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ImageError('unreadable');
  });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const small = /^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= KEEP_BELOW;
    if (scale === 1 && small) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('no canvas');
    ctx.fillStyle = '#ffffff'; // a transparent PNG becomes white, not black, as a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) throw new ImageError('encode failed');
    return blob;
  } finally {
    bitmap.close();
  }
}

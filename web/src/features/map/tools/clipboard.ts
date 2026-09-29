/** Phones open the native share sheet (a pasted link would otherwise turn into a web search in some apps). */
export const isMobileBrowser = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Copy text; falls back to a hidden textarea where the async clipboard API is missing. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(area);
    }
  } catch {
    return false;
  }
}

/** Open the native share sheet. Resolves false when it is unavailable or the user closed it. */
export async function nativeShare(data: { title: string; url: string }): Promise<boolean> {
  if (typeof navigator.share !== 'function') return false;
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false; // AbortError: the user closed the sheet
  }
}

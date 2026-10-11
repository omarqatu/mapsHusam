/** One id per browser tab for visitor analytics; it is not an authentication credential. */
export function getVisitorId(): string | undefined {
  try {
    let id = sessionStorage.getItem('psm-visitor');
    if (!id) {
      id = `guest-${Math.random().toString(36).slice(2, 12)}`;
      sessionStorage.setItem('psm-visitor', id);
    }
    return id;
  } catch {
    return undefined;
  }
}

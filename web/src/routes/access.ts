// Who may open the home page without an account: a guest or a visitor with a shared location / results link.

/** The visitor chose "browse as guest" on the welcome page (cleared when someone logs in). */
export function isGuestMode(): boolean {
  try {
    return localStorage.getItem('guest_mode') === 'true';
  } catch {
    return false;
  }
}

/** Check if URL has specific parameters that should bypass the welcome page (shared locations, results, etc.) */
export function hasDirectAccessParams(searchParams: URLSearchParams): boolean {
  return (
    searchParams.has('x') && searchParams.has('y') ||
    searchParams.has('resultsShare')
  );
}

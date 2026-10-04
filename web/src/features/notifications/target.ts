/** Where a notification leads when clicked (`notifications.link`, written by the server). */
export type NotificationTarget =
  { kind: 'request'; id: number } | { kind: 'page'; path: string } | { kind: 'none' };

/**
 * `request:<id>` opens that request's chat; an app path (`/admin/submissions`) opens the page. Anything else (no link,
 * older notifications, an external or malformed value) has no target: the full text is shown instead.
 */
export function notificationTarget(link: string | null | undefined): NotificationTarget {
  if (!link) return { kind: 'none' };
  const request = /^request:(\d{1,9})$/.exec(link);
  if (request) {
    const id = Number(request[1]);
    return id > 0 ? { kind: 'request', id } : { kind: 'none' };
  }
  // Same-origin app paths only: no `//host`, no scheme, no backslash tricks.
  if (/^\/(?![/\\])[A-Za-z0-9/_?=&.-]*$/.test(link)) return { kind: 'page', path: link };
  return { kind: 'none' };
}

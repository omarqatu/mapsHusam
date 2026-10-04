import { ApiError } from '@/api/client';

/** The server's own (Arabic) message when it sent one — legacy showed it — else the translated fallback. */
export function errorText(e: unknown, fallback: string): string {
  return e instanceof ApiError && e.status > 0 && e.message ? e.message : fallback;
}

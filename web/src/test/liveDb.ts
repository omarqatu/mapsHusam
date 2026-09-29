/// <reference types="node" />
// Cleanup helper for the live (real-backend) tests: there is no "delete user" endpoint, so throwaway accounts are
// removed straight from the dev database (podman container of dev/dev.sh). Only rows whose name starts with the
// given prefix are touched, so the seeded accounts can never be deleted by mistake.
import { execFileSync } from 'node:child_process';

const CONTAINER = 'psm-dev-pg';

export function deleteThrowawayUsers(namePrefix: string): void {
  if (!/^[A-Z][A-Z0-9-]{5,}$/.test(namePrefix)) throw new Error('unsafe throwaway prefix');
  const ids = `(SELECT user_id FROM public.users WHERE full_name LIKE '${namePrefix}%')`;
  const sql = [
    `DELETE FROM public.service_request_messages WHERE request_id IN (SELECT id FROM public.service_requests WHERE user_id IN ${ids} OR provider_user_id IN ${ids})`,
    `DELETE FROM public.service_requests WHERE user_id IN ${ids} OR provider_user_id IN ${ids}`,
    `DELETE FROM public.notifications WHERE user_id IN ${ids}`,
    `DELETE FROM public.users WHERE full_name LIKE '${namePrefix}%'`,
  ].join('; ');
  try {
    execFileSync(
      'podman',
      ['exec', CONTAINER, 'psql', '-U', 'psm', '-d', 'services_db', '-v', 'ON_ERROR_STOP=0', '-c', sql],
      {
        stdio: 'pipe',
      },
    );
  } catch (e) {
    console.warn(`could not clean up throwaway users "${namePrefix}*" (is ${CONTAINER} running?)`, e);
  }
}

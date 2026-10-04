import type { MyListing } from '@/api/myListings';
import type { Profile, ProfileEdit } from '@/api/profile';

/** The profile form as typed (the phone is not part of it: it is the login). */
export interface ProfileForm {
  name: string;
  whatsapp: string;
  email: string;
}

export const toProfileForm = (p: Profile): ProfileForm => ({
  name: p.full_name ?? '',
  whatsapp: p.whatsapp_number ?? '',
  email: p.email ?? '',
});

/** Only what changed, trimmed (the server normalises WhatsApp, e.g. 05… → +9705…). */
export function profileEdit(v: ProfileForm, p: Profile): ProfileEdit {
  const was = toProfileForm(p);
  const edit: ProfileEdit = {};
  if (v.name.trim() !== was.name.trim()) edit.full_name = v.name.trim();
  if (v.whatsapp.trim() !== was.whatsapp.trim()) edit.whatsapp_number = v.whatsapp.trim();
  if (v.email.trim().toLowerCase() !== was.email.trim().toLowerCase()) edit.email = v.email.trim();
  return edit;
}

export type ProfileProblem =
  | { field: 'name'; code: 'nameEmpty' }
  | { field: 'whatsapp'; code: 'whatsapp' }
  | { field: 'email'; code: 'email' }
  | null;

/** The first thing to fix before sending, or null. */
export function profileProblem(v: ProfileForm): ProfileProblem {
  if (!v.name.trim()) return { field: 'name', code: 'nameEmpty' };
  const wa = v.whatsapp.replace(/[\s-]/g, '');
  if (wa && !/^(\+|00)?\d{9,15}$/.test(wa)) return { field: 'whatsapp', code: 'whatsapp' };
  const email = v.email.trim();
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return { field: 'email', code: 'email' };
  return null;
}

/** My standing as a publisher: every rating of all my listings, averaged (as `GET /api/publisher-rating`); null = none. */
export function publisherRating(listings: Pick<MyListing, 'rating_avg' | 'rating_count'>[]) {
  let sum = 0;
  let count = 0;
  for (const l of listings)
    if (l.rating_avg !== null && l.rating_count > 0) {
      sum += l.rating_avg * l.rating_count;
      count += l.rating_count;
    }
  return count ? { average: sum / count, count } : null;
}

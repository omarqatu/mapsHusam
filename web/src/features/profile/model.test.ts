import { describe, expect, it } from 'vitest';
import type { Profile } from '@/api/profile';
import { profileEdit, profileProblem, publisherRating, toProfileForm } from './model';

const me: Profile = {
  user_id: 7,
  full_name: 'سامي',
  phone: '0599000000',
  whatsapp_number: null,
  email: 'sami@x.ps',
  role: 'user',
};

describe('profile form', () => {
  it('sends only what changed', () => {
    expect(profileEdit(toProfileForm(me), me)).toEqual({});
    expect(profileEdit({ ...toProfileForm(me), name: ' سامي خالد ' }, me)).toEqual({
      full_name: 'سامي خالد',
    });
    expect(profileEdit({ ...toProfileForm(me), whatsapp: '0599111222' }, me)).toEqual({
      whatsapp_number: '0599111222',
    });
    // the email case is not a change; clearing it is
    expect(profileEdit({ ...toProfileForm(me), email: 'SAMI@x.ps' }, me)).toEqual({});
    expect(profileEdit({ ...toProfileForm(me), email: '' }, me)).toEqual({ email: '' });
  });

  it('finds what to fix first', () => {
    const ok = toProfileForm(me);
    expect(profileProblem(ok)).toBeNull();
    expect(profileProblem({ ...ok, name: '  ' })).toEqual({ field: 'name', code: 'nameEmpty' });
    expect(profileProblem({ ...ok, whatsapp: '12' })).toEqual({ field: 'whatsapp', code: 'whatsapp' });
    expect(profileProblem({ ...ok, whatsapp: '+970 599-111-222' })).toBeNull();
    expect(profileProblem({ ...ok, email: 'nope' })).toEqual({ field: 'email', code: 'email' });
    expect(profileProblem({ ...ok, email: '' })).toBeNull();
  });
});

describe('publisherRating', () => {
  it('weighs each listing by its number of ratings', () => {
    expect(publisherRating([])).toBeNull();
    expect(publisherRating([{ rating_avg: null, rating_count: 0 }])).toBeNull();
    expect(
      publisherRating([
        { rating_avg: 5, rating_count: 3 },
        { rating_avg: 3, rating_count: 1 },
        { rating_avg: null, rating_count: 0 },
      ]),
    ).toEqual({ average: 4.5, count: 4 });
  });
});

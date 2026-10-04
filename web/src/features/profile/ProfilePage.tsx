import { useState, type FormEvent } from 'react';
import {
  Bell,
  ClipboardList,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  Save,
  ShieldCheck,
  Star,
  Store,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMyListings } from '@/api/myListings';
import { useProfile, useUpdateProfile, type Profile, type ProfileEdit } from '@/api/profile';
import AlertMessage from '@/components/ui/AlertMessage';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import ChangePasswordDialog from '@/features/auth/ChangePasswordDialog';
import { useHomeData } from '@/features/home/useHomeData';
import { useRequestsUi } from '@/features/requests/store';
import { errorText } from '@/lib/errorText';
import { formatNumber } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { profileEdit, profileProblem, publisherRating, toProfileForm, type ProfileForm } from './model';

/**
 * `/profile` — the account's own page: who I am, my figures (listings, rating, open requests, unread — each opens its
 * screen), my details (the phone is the login and stays), password.
 */
export default function ProfilePage() {
  const { t } = useTranslation();
  const profile = useProfile();
  const header = (
    <PageHeader
      title={t('profile.title')}
      description={t('profile.subtitle')}
      icon={<UserRound className="h-6 w-6" aria-hidden />}
    />
  );
  if (profile.isPending) return <CenteredSpinner />;
  if (profile.isError)
    return (
      <>
        {header}
        <AlertMessage type="error" message={errorText(profile.error, t('profile.loadFailed'))} />
      </>
    );
  return (
    <>
      {header}
      <div className="mx-auto grid max-w-3xl gap-4">
        <Identity profile={profile.data} />
        <Figures />
        <DetailsForm key={profile.dataUpdatedAt} profile={profile.data} />
        <Security />
      </div>
    </>
  );
}

function Identity({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const name = profile.full_name || profile.phone;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand-light to-surface p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <Avatar name={name} className="h-16 w-16 text-2xl" />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-black text-fg">{name}</h2>
          <span className="mt-1 inline-block rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">
            {t(`roles.${profile.role}`)}
          </span>
          <p className="mt-1.5 text-sm text-muted">
            <bdi dir="ltr">{profile.phone}</bdi>
          </p>
        </div>
      </div>
    </section>
  );
}

function DetailsForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const save = useUpdateProfile();
  const [v, setV] = useState<ProfileForm>(() => toProfileForm(profile));
  const [problem, setProblem] = useState<ReturnType<typeof profileProblem>>(null);
  const set = (k: keyof ProfileForm, value: string) => {
    setV((old: ProfileForm) => ({ ...old, [k]: value }));
    setProblem(null);
  };
  const edit: ProfileEdit = profileEdit(v, profile);
  const changed = Object.keys(edit).length > 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = profileProblem(v);
    setProblem(found);
    if (found || !changed) return;
    save.mutate(edit, {
      onSuccess: () => toast.success(t('profile.saved')),
      onError: (err) => toast.error(errorText(err, t('profile.saveFailed'))),
    });
  }

  return (
    <SectionCard title={t('profile.details')} icon={<UserRound className="h-5 w-5" aria-hidden />}>
      <form onSubmit={onSubmit} noValidate>
        <FormField
          label={t('profile.name')}
          name="pf-name"
          required
          error={problem?.field === 'name' ? t(`profile.errors.${problem.code}`) : undefined}
        >
          <TextInput
            id="pf-name"
            autoComplete="name"
            maxLength={100}
            value={v.name}
            hasError={problem?.field === 'name'}
            startIcon={<UserRound className="h-4 w-4" aria-hidden />}
            onChange={(e) => set('name', e.target.value)}
          />
        </FormField>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormField label={t('profile.phone')} name="pf-phone" hint={t('profile.phoneHint')}>
            <div dir="ltr">
              <TextInput
                id="pf-phone"
                value={profile.phone}
                readOnly
                className="bg-subtle"
                startIcon={<Phone className="h-4 w-4" aria-hidden />}
              />
            </div>
          </FormField>
          <FormField
            label={t('profile.whatsapp')}
            name="pf-whatsapp"
            hint={t('profile.whatsappHint')}
            error={problem?.field === 'whatsapp' ? t(`profile.errors.${problem.code}`) : undefined}
          >
            <div dir="ltr">
              <TextInput
                id="pf-whatsapp"
                type="tel"
                inputMode="tel"
                placeholder="05XXXXXXXX"
                value={v.whatsapp}
                hasError={problem?.field === 'whatsapp'}
                startIcon={<MessageCircle className="h-4 w-4" aria-hidden />}
                onChange={(e) => set('whatsapp', e.target.value)}
              />
            </div>
          </FormField>
        </div>
        <FormField
          label={t('profile.email')}
          name="pf-email"
          error={problem?.field === 'email' ? t(`profile.errors.${problem.code}`) : undefined}
        >
          <div dir="ltr">
            <TextInput
              id="pf-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={150}
              value={v.email}
              hasError={problem?.field === 'email'}
              startIcon={<Mail className="h-4 w-4" aria-hidden />}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
        </FormField>
        <div className="flex justify-end">
          <Button
            type="submit"
            loading={save.isPending}
            disabled={!changed}
            startIcon={<Save className="h-4 w-4" aria-hidden />}
          >
            {t('profile.save')}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function Security() {
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const [pwdOpen, setPwdOpen] = useState(false);
  return (
    <SectionCard title={t('profile.security')} icon={<ShieldCheck className="h-5 w-5" aria-hidden />}>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          startIcon={<KeyRound className="h-4 w-4" aria-hidden />}
          onClick={() => setPwdOpen(true)}
        >
          {t('auth.changePassword.open')}
        </Button>
        <Button
          variant="ghost"
          className="text-danger"
          startIcon={<LogOut className="h-4 w-4" aria-hidden />}
          onClick={logout}
        >
          {t('auth.logout')}
        </Button>
      </div>
      <ChangePasswordDialog open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </SectionCard>
  );
}

function Figures() {
  const { t, i18n } = useTranslation();
  const listings = useMyListings();
  const home = useHomeData();
  const num = (n: number) => formatNumber(n, i18n.language);
  const all = listings.data ?? [];
  const rating = publisherRating(all);
  const openRequests = home.requests.waitingReply + home.requests.active + home.requests.incoming;
  const tile =
    'flex min-w-0 flex-col items-center gap-0.5 rounded-xl border border-line bg-surface px-2 py-3 text-center transition-colors hover:border-brand hover:bg-brand-light';
  const value = 'text-xl font-black text-fg';
  const label = 'text-xs font-semibold text-muted';
  return (
    <section aria-label={t('profile.figures')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Link to="/my-listings" className={tile}>
        <Store className="h-5 w-5 text-brand-fg" aria-hidden />
        <span className={value}>{listings.isPending ? '…' : num(all.length)}</span>
        <span className={label}>{t('profile.listings')}</span>
      </Link>
      <Link to="/my-listings" className={tile}>
        <Star className="h-5 w-5 text-warn" aria-hidden />
        <span className={value}>{rating ? rating.average.toFixed(1) : '—'}</span>
        <span className={label}>
          {rating ? t('profile.ratingCount', { count: rating.count }) : t('profile.noRatings')}
        </span>
      </Link>
      <button type="button" onClick={() => useRequestsUi.getState().openList()} className={tile}>
        <ClipboardList className="h-5 w-5 text-ok" aria-hidden />
        <span className={value}>{num(openRequests)}</span>
        <span className={label}>{t('profile.openRequests')}</span>
      </button>
      <Link to="/notifications" className={tile}>
        <Bell className="h-5 w-5 text-info" aria-hidden />
        <span className={value}>{num(home.unread)}</span>
        <span className={label}>{t('profile.unread')}</span>
      </Link>
    </section>
  );
}

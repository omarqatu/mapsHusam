import { Link, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ClipboardList,
  Gift,
  LogIn,
  MapPin,
  MessageCircle,
  UserPlus,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import { useCategoryCounts, usePlatformStats } from '@/api/platform';
import { formatNumber } from '@/lib/format';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LegalLinks from '@/features/legal/LegalLinks';

/** Real numbers for the two cards that used to promise them in fixed words (keyed by the feature). */
type Counts = Partial<Record<'realEstate' | 'providers', number>>;

type FeatureKey = 'realEstate' | 'providers' | 'location' | 'contact' | 'search' | 'free';

/** Each feature on a solid tile in one of the logo's colours (white icon), like the brand board. */
const FEATURES: { key: FeatureKey; Icon: LucideIcon; tile: string }[] = [
  { key: 'realEstate', Icon: Building2, tile: 'bg-tile-green' },
  { key: 'providers', Icon: Wrench, tile: 'bg-tile-teal' },
  { key: 'location', Icon: MapPin, tile: 'bg-tile-blue' },
  { key: 'contact', Icon: MessageCircle, tile: 'bg-tile-green' },
  { key: 'search', Icon: ClipboardList, tile: 'bg-tile-blue' },
  { key: 'free', Icon: Gift, tile: 'bg-tile-amber' },
];

const cta =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

/** `/welcome` — the first screen: what Nitaq is, and the three ways in (sign up, sign in, look around as a guest). */
export default function WelcomePage() {
  const { t, i18n } = useTranslation();
  const { state } = useLocation();
  const navigate = useNavigate();
  const arabic = i18n.resolvedLanguage?.startsWith('ar') ?? true;
  const Forward = arabic ? ArrowLeft : ArrowRight;
  // Real figures; nothing is shown until they arrive (or if the request fails).
  const stats = usePlatformStats().data;
  const listed = useCategoryCounts().data;
  const counts: Counts = {
    realEstate: listed ? (listed.ApartRent ?? 0) + (listed.ApartSale ?? 0) + (listed.LandSale ?? 0) : undefined,
    providers: stats?.servicesCount,
  };
  const figures = stats
    ? [
        { value: stats.featuresCount, label: t('searchPage.statProviders') },
        { value: stats.servicesCount, label: t('searchPage.statServices') },
        { value: stats.viewsTotal, label: t('searchPage.statVisits') },
      ].filter((f) => f.value > 0) // "0 visits" reads as a dead platform
    : [];

  const browseAsGuest = () => {
    try {
      localStorage.setItem('guest_mode', 'true');
    } catch {
      // Storage blocked (private mode): the map opens anyway, the guest choice is just not remembered.
    }
    navigate('/');
  };

  return (
    <main className="brand-backdrop min-h-dvh text-fg" dir={arabic ? 'rtl' : 'ltr'}>
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <span className="flex items-center gap-2.5">
          <BrandMark className="h-10 w-10" />
          <span className="text-2xl font-black text-brand-fg">{t('app.shortName')}</span>
        </span>
        <div className="rounded-xl border border-line bg-surface/80">
          <LanguageSwitcher />
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 pb-10 pt-4 md:grid-cols-[1.05fr_1fr] md:gap-12 md:pt-10">
        <div className="text-center md:text-start">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brand/15 bg-surface/80 px-3 py-1 text-sm font-bold text-brand-fg">
            <MapPin className="h-4 w-4 text-brand-2-fg" aria-hidden />
            {t('auth.welcome.eyebrow')}
          </p>
          <h1 className="mt-4 text-[clamp(2rem,5.5vw,3.5rem)] font-black leading-[1.2]">
            {t('auth.welcome.tagline')}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-muted md:mx-0 md:text-lg">
            {t('auth.welcome.subtitle')}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <Link to="/register" state={state} className={clsx(cta, 'bg-brand text-white shadow-card hover:bg-brand-hover')}>
              <UserPlus className="h-5 w-5" aria-hidden />
              {t('auth.welcome.register')}
            </Link>
            <Link
              to="/login"
              state={state}
              className={clsx(cta, 'border-2 border-brand/25 bg-surface text-brand-fg hover:border-brand/50 hover:bg-brand-light')}
            >
              <LogIn className="h-5 w-5" aria-hidden />
              {t('auth.welcome.login')}
            </Link>
          </div>
          <button
            type="button"
            onClick={browseAsGuest}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-bold text-brand-fg underline-offset-4 hover:underline"
          >
            {t('auth.welcome.guest')}
            <Forward className="h-4 w-4" aria-hidden />
          </button>

          {figures.length > 0 && (
            <dl className="mt-7 flex justify-center gap-8 border-t border-line pt-5 md:justify-start">
              {figures.map((f) => (
                <div key={f.label} className="flex flex-col-reverse">
                  <dt className="text-sm text-muted">{f.label}</dt>
                  <dd className="text-2xl font-black tabular-nums text-brand-fg">{formatNumber(f.value, i18n.language)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-tile-teal/15 via-transparent to-tile-green/20 blur-2xl" />
          <img
            src="/brand/welcome-map.webp"
            alt=""
            width={562}
            height={349}
            className="w-full rounded-3xl border border-line bg-surface shadow-float"
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-10" aria-label={t('app.name')}>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {FEATURES.map(({ key, Icon, tile }) => (
            <li key={key} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5 shadow-card sm:flex-row sm:items-start sm:gap-3 sm:p-4">
              <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white', tile)} aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold leading-snug sm:text-base">{t(`auth.welcome.features.${key}.label`)}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {key in counts && counts[key as keyof Counts]
                    ? t(`auth.welcome.features.${key}.descCount`, { count: counts[key as keyof Counts] })
                    : t(`auth.welcome.features.${key}.desc`)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-line bg-surface/70 px-4 py-4 text-center text-sm text-muted">
        <span className="me-1">{t('auth.welcome.agreeNote')}</span>
        <LegalLinks className="mt-1 justify-center" linkClassName="font-bold text-brand-fg" />
      </footer>
    </main>
  );
}

import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Ambulance,
  Building2,
  Camera,
  CarTaxiFront,
  ClipboardList,
  Compass,
  Gift,
  Hammer,
  House,
  LogIn,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Stethoscope,
  UserPlus,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useCategoryCounts, usePlatformStats } from '@/api/platform';
import { formatNumber } from '@/lib/format';
import LegalLinks from '@/features/legal/LegalLinks';
import PromoSlideshow from './welcome/PromoSlideshow';

/** Real numbers for the two cards that used to promise them in fixed words (keyed by the feature). */
type Counts = Partial<Record<'realEstate' | 'providers', number>>;

const FEATURES: { key: 'realEstate' | 'providers' | 'location' | 'contact' | 'search' | 'free'; Icon: LucideIcon }[] = [
  { key: 'realEstate', Icon: Building2 },
  { key: 'providers', Icon: Wrench },
  { key: 'location', Icon: MapPin },
  { key: 'contact', Icon: MessageCircle },
  { key: 'search', Icon: ClipboardList },
  { key: 'free', Icon: Gift },
];

/** Icons drifting up the splash (decoration only), each from the icon library. */
const FLOATING: { Icon: LucideIcon; left: string; delay: string }[] = [
  { Icon: Compass, left: '5%', delay: '0s' },
  { Icon: House, left: '15%', delay: '3s' },
  { Icon: Wrench, left: '30%', delay: '6s' },
  { Icon: MapPin, left: '50%', delay: '2s' },
  { Icon: Camera, left: '65%', delay: '5s' },
  { Icon: Ambulance, left: '78%', delay: '1s' },
  { Icon: Zap, left: '90%', delay: '4s' },
  { Icon: Stethoscope, left: '10%', delay: '7s' },
  { Icon: CarTaxiFront, left: '40%', delay: '8s' },
  { Icon: Hammer, left: '75%', delay: '9s' },
];

/** `/welcome` — the original full-screen promo splash from the legacy site. */
export default function WelcomePage() {
  const { t, i18n } = useTranslation();
  const { state } = useLocation();
  const arabic = i18n.resolvedLanguage?.startsWith('ar') ?? true;
  // Real figures under the feature cards; nothing is shown until they arrive (or if the request fails).
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
      ]
    : [];

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-[#0a0a1a] text-white" dir={arabic ? 'rtl' : 'ltr'}>
      <PromoSlideshow />
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.6)_50%,rgba(0,0,0,0.85)_100%)]" />

      {FLOATING.map(({ Icon, left, delay }) => (
        <span
          key={`${left}-${delay}`}
          className="welcome-float absolute z-[1] select-none opacity-25 drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]"
          style={{ left, animationDelay: delay }}
          aria-hidden
        >
          <Icon className="h-9 w-9 sm:h-12 sm:w-12" strokeWidth={1.5} />
        </span>
      ))}

      <section className="welcome-enter relative z-[2] mx-auto flex min-h-dvh w-[90%] max-w-[850px] flex-col items-center justify-center px-5 py-8 text-center">
        <span className="welcome-pulse mb-4 block text-[#4fc3f7] drop-shadow-[0_0_40px_rgba(79,195,247,0.5)]" aria-hidden>
          <MapIcon className="h-14 w-14 max-sm:h-12 max-sm:w-12" strokeWidth={1.5} />
        </span>

        <h1 className="m-0 text-[clamp(1.75rem,6vw,3.25rem)] font-black leading-[1.3] text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <span className="welcome-highlight">{t('auth.welcome.title')}</span>
          <br />
          {t('auth.welcome.tagline')}
        </h1>

        <p className="mx-auto mb-6 mt-4 max-w-[650px] text-[clamp(0.875rem,2.5vw,1.25rem)] leading-[1.8] text-white/85 max-sm:text-[13px] max-sm:leading-[1.6]">
          {t('auth.welcome.subtitle')}
        </p>

        <ul className="my-6 grid w-full grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:gap-2">
          {FEATURES.map(({ key, Icon }) => (
            <li
              key={key}
              className="rounded-2xl border border-white/15 bg-white/[0.08] px-3 py-5 text-center shadow-none backdrop-blur-[10px] transition duration-300 hover:-translate-y-1 hover:bg-white/15 hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] max-sm:rounded-[10px] max-sm:px-1.5 max-sm:py-2.5"
            >
              <span className="mb-2.5 flex justify-center text-[#4fc3f7] max-sm:mb-1" aria-hidden>
                <Icon className="h-9 w-9 max-sm:h-6 max-sm:w-6" strokeWidth={1.6} />
              </span>
              <span className="block text-sm font-bold leading-snug text-white max-sm:text-[11px]">
                {t(`auth.welcome.features.${key}.label`)}
              </span>
              <span className="mt-1 block text-xs text-white/70 max-sm:hidden">
                {key in counts && counts[key as keyof Counts]
                  ? t(`auth.welcome.features.${key}.descCount`, { count: counts[key as keyof Counts] })
                  : t(`auth.welcome.features.${key}.desc`)}
              </span>
            </li>
          ))}
        </ul>

        {figures.length > 0 && (
          <dl className="mb-2 flex w-full justify-center gap-6 max-sm:gap-4">
            {figures.map((f) => (
              <div key={f.label} className="text-center">
                <dt className="sr-only">{f.label}</dt>
                <dd className="m-0 text-2xl font-black tabular-nums text-white max-sm:text-lg">{formatNumber(f.value, i18n.language)}</dd>
                <span className="text-xs text-white/70 max-sm:text-[11px]" aria-hidden>{f.label}</span>
              </div>
            ))}
          </dl>
        )}

        <div className="my-4 flex flex-wrap justify-center gap-4 max-sm:w-full max-sm:flex-col max-sm:items-center">
          <Link
            to="/register"
            state={state}
            className="inline-flex min-h-14 min-w-[200px] items-center justify-center gap-2.5 rounded-full bg-gradient-to-br from-[#4fc3f7] to-[#00e676] px-8 py-4 text-base font-bold text-[#0a0a1a] shadow-[0_4px_20px_rgba(79,195,247,0.4)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(79,195,247,0.6)] max-sm:w-full max-sm:max-w-[300px] max-sm:min-w-0 max-sm:px-5 max-sm:py-3.5 max-sm:text-sm"
          >
            <UserPlus className="h-5 w-5" aria-hidden />
            {t('auth.welcome.register')}
          </Link>
          <Link
            to="/login"
            state={state}
            className="inline-flex min-h-14 min-w-[200px] items-center justify-center gap-2.5 rounded-full border-2 border-white/30 bg-white/10 px-8 py-4 text-base font-bold text-white backdrop-blur-[10px] transition duration-300 hover:-translate-y-1 hover:border-white/60 hover:bg-white/20 max-sm:w-full max-sm:max-w-[300px] max-sm:min-w-0 max-sm:px-5 max-sm:py-3.5 max-sm:text-sm"
          >
            <LogIn className="h-5 w-5" aria-hidden />
            {t('auth.welcome.login')}
          </Link>
        </div>

        <p className="mt-1 text-[13px] leading-relaxed text-white/50">{t('auth.welcome.footer')}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-white/70">
          <span>{t('auth.welcome.agreeNote')}</span>
          <LegalLinks linkClassName="text-white font-bold" />
        </div>
      </section>
    </main>
  );
}

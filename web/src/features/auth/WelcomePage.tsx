import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Building2, Gift, LogIn, MapPin, MessageCircle, SearchCheck, UserPlus, Wrench } from 'lucide-react';
import LegalLinks from '@/features/legal/LegalLinks';

const features = [
  { key: 'realEstate', Icon: Building2 },
  { key: 'providers', Icon: Wrench },
  { key: 'location', Icon: MapPin },
  { key: 'contact', Icon: MessageCircle },
  { key: 'search', Icon: SearchCheck },
  { key: 'free', Icon: Gift },
] as const;

/** Legacy promo splash (`#promo-splash-overlay`): pitch + "create account" / "log in". */
export default function WelcomePage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl py-6 text-center">
      <h1 className="text-3xl font-black text-fg sm:text-4xl">
        <span className="text-brand-fg">{t('auth.welcome.title')}</span>
        <br />
        {t('auth.welcome.tagline')}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-muted">{t('auth.welcome.subtitle')}</p>

      <ul className="mt-8 grid grid-cols-1 gap-3 text-start sm:grid-cols-2 md:grid-cols-3">
        {features.map(({ key, Icon }) => (
          <li
            key={key}
            className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm"
          >
            <span className="rounded-lg bg-brand-light p-2 text-brand-fg">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block font-bold text-fg">
                {t(`auth.welcome.features.${key}.label`)}
              </span>
              <span className="block text-sm text-muted">{t(`auth.welcome.features.${key}.desc`)}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to="/register"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-6 font-bold text-white hover:bg-brand-hover"
        >
          <UserPlus className="h-5 w-5" aria-hidden />
          {t('auth.welcome.register')}
        </Link>
        <Link
          to="/login"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-brand bg-surface px-6 font-bold text-brand-fg hover:bg-brand-light"
        >
          <LogIn className="h-5 w-5" aria-hidden />
          {t('auth.welcome.login')}
        </Link>
      </div>
      <p className="mt-4 text-sm text-muted">{t('auth.welcome.footer')}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-1 text-xs text-muted">
        {t('auth.welcome.agreeNote')}
        <LegalLinks keys={['terms', 'privacy']} linkClassName="text-brand-fg" />
      </div>
    </div>
  );
}

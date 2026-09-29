import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { changeLanguage } from '@/i18n';

export default function LanguageSwitcher({ tone = 'default' }: { tone?: 'default' | 'onBrand' }) {
  const { t, i18n } = useTranslation();
  const next = i18n.language === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      onClick={() => changeLanguage(next)}
      aria-label={t('common.language')}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold',
        tone === 'onBrand' ? 'text-white hover:bg-white/15' : 'text-slate-600 hover:bg-slate-100',
      )}
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{next === 'ar' ? 'العربية' : 'English'}</span>
    </button>
  );
}

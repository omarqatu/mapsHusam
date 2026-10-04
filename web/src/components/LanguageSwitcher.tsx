import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/i18n';

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const next = i18n.language === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      onClick={() => changeLanguage(next)}
      aria-label={t('common.language')}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-subtle"
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{next === 'ar' ? 'العربية' : 'English'}</span>
    </button>
  );
}

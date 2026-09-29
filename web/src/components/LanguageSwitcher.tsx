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
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
    >
      <Languages className="h-4 w-4" aria-hidden />
      {next === 'ar' ? 'العربية' : 'English'}
    </button>
  );
}

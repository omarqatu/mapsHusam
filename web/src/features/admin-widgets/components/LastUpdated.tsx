import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, parseServerDate } from '@/lib/format';

/** "Last update: <date>" chip; a group nobody has saved yet says so (legacy formatDate). */
export default function LastUpdated({ at }: { at: string | null | undefined }) {
  const { t, i18n } = useTranslation();
  const d = at ? parseServerDate(at) : null;
  const text = !at
    ? t('adminWidgets.noUpdateYet')
    : d
      ? formatDateTime(d, i18n.language)
      : t('adminWidgets.unknownDate');
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
      <Clock className="h-4 w-4" aria-hidden />
      {t('adminWidgets.lastUpdate')}: {text}
    </span>
  );
}

import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import EmptyState from '@/components/ui/EmptyState';

export default function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<ShieldAlert className="h-10 w-10" aria-hidden />}
      title={t('errors.forbiddenTitle')}
      action={
        <Link to="/" className="mt-2 font-semibold text-brand-fg hover:underline">
          {t('common.back')}
        </Link>
      }
    />
  );
}

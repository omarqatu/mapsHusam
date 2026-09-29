import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import EmptyState from '@/components/ui/EmptyState';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t('errors.notFoundTitle')}
      description={t('errors.notFoundBody')}
      action={
        <Link to="/" className="mt-2 font-semibold text-brand hover:underline">
          {t('common.back')}
        </Link>
      }
    />
  );
}

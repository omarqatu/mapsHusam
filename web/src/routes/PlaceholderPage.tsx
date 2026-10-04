import { Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/ui/PageHeader';
import type { AppRoute } from './routes';

/** Stand-in until the page is ported (see PLAN.md). */
export default function PlaceholderPage({ route }: { route: AppRoute }) {
  const { t } = useTranslation();
  return (
    <PageHeader
      title={t(route.titleKey)}
      description={t('placeholder.legacy', { source: route.legacy })}
      icon={<Construction className="h-6 w-6" aria-hidden />}
      actions={<span className="text-sm font-semibold text-muted">{t('placeholder.title')}</span>}
    />
  );
}

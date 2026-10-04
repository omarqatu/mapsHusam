import { Link } from 'react-router';
import { LayoutGrid, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/ui/PageHeader';
import TickerBar from './components/TickerBar';

/**
 * `/widgets/ticker` — the ticker on a page of its own, large enough to read from a distance (a shop screen, a kiosk).
 * The same bar sits at the bottom of the map and of the search page.
 */
export default function WidgetsTickerPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader
        title={t('widgets.ticker.pageTitle')}
        description={t('widgets.ticker.pageDescription')}
        icon={<Zap className="h-6 w-6" aria-hidden />}
        actions={
          <Link
            to="/widgets/portal"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-base font-semibold text-fg hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            {t('widgets.ticker.open')}
          </Link>
        }
      />
      <TickerBar variant="page" />
      <p className="mt-3 text-base text-fg">{t('widgets.ticker.hint')}</p>
    </div>
  );
}

import { CloudSun, Moon, RefreshCw, Sun, Sunrise, Sunset, MoonStar } from 'lucide-react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Badge from '@/components/ui/Badge';
import { CenteredSpinner } from '@/components/ui/Spinner';
import UpdatedAgo from '@/features/map/extras/UpdatedAgo';
import { isoFromMs, nextPrayer, palestineNow, PRAYER_KEYS, type PrayerKey } from '../model';
import { usePrayerTimes } from '../hooks/useWidgets';
import GroupCard from './GroupCard';

const ICON: Record<PrayerKey, ReactNode> = {
  fajr: <Moon className="h-5 w-5" aria-hidden />,
  sunrise: <Sunrise className="h-5 w-5" aria-hidden />,
  dhuhr: <Sun className="h-5 w-5" aria-hidden />,
  asr: <CloudSun className="h-5 w-5" aria-hidden />,
  maghrib: <Sunset className="h-5 w-5" aria-hidden />,
  isha: <MoonStar className="h-5 w-5" aria-hidden />,
};

/** The six times of the day for Jerusalem (Aladhan), the next prayer highlighted. */
export default function PrayerCard({
  id,
  title,
  now,
  className,
}: {
  id: string;
  title: string;
  now: Date;
  className?: string;
}) {
  const { t } = useTranslation();
  const times = usePrayerTimes(now);
  const next = times.data ? nextPrayer(times.data, palestineNow(now).minutes) : null;

  return (
    <GroupCard
      id={id}
      title={title}
      icon={<MoonStar className="h-5 w-5" aria-hidden />}
      chip="bg-teal-100 text-teal-800"
      subtitle={
        times.data ? <UpdatedAgo at={isoFromMs(times.dataUpdatedAt)} now={times.dataUpdatedAt} /> : undefined
      }
      className={className}
    >
      {times.isPending ? (
        <CenteredSpinner minHeight="8rem" />
      ) : times.isError ? (
        <div className="space-y-3">
          <AlertMessage type="error" message={t('widgets.prayer.failed')} />
          <button
            type="button"
            onClick={() => void times.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> {t('common.retry')}
          </button>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRAYER_KEYS.map((key) => {
              const isNext = next?.key === key;
              return (
                <li
                  key={key}
                  className={clsx(
                    'flex items-center gap-3 rounded-xl border p-3',
                    isNext ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500' : 'border-slate-200 bg-white',
                  )}
                  aria-current={isNext ? 'true' : undefined}
                >
                  <span className={clsx('shrink-0', isNext ? 'text-teal-700' : 'text-slate-600')}>
                    {ICON[key]}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-700">
                      {t(`widgets.prayer.${key}`)}
                    </div>
                    <div className="text-xl font-black tabular-nums text-slate-900" dir="ltr">
                      {times.data[key]}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            {next && (
              <Badge tone="green" large>
                {t('widgets.prayer.next')}: {t(`widgets.prayer.${next.key}`)}
                {next.tomorrow ? ` (${t('widgets.prayer.tomorrow')})` : ''}
              </Badge>
            )}
            <span>{t('widgets.prayer.source')}</span>
          </div>
        </>
      )}
    </GroupCard>
  );
}

import { CalendarDays, CalendarHeart, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WidgetItem } from '@/api/adminWidgets';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import UpdatedAgo from '@/features/map/extras/UpdatedAgo';
import { formatDate } from '@/lib/format';
import {
  formatGregorianLong,
  formatHijri,
  isoToDate,
  palestineNow,
  splitEvents,
  type EventRow,
} from '../model';
import GroupCard from './GroupCard';

function DateTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <span className="shrink-0 text-brand-fg">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-muted">{label}</div>
        <div className="text-lg font-black text-fg" dir="auto">
          {value}
        </div>
      </div>
    </div>
  );
}

function daysBadge(days: number | null, t: (k: string, o?: Record<string, unknown>) => string) {
  if (days === null) return null;
  if (days === 0)
    return (
      <Badge tone="green" large>
        {t('widgets.calendar.today')}
      </Badge>
    );
  if (days === 1)
    return (
      <Badge tone="amber" large>
        {t('widgets.calendar.tomorrow')}
      </Badge>
    );
  return (
    <Badge tone={days < 0 ? 'slate' : 'blue'} large>
      {t(days < 0 ? 'widgets.calendar.daysAgo' : 'widgets.calendar.inDays', { count: Math.abs(days) })}
    </Badge>
  );
}

function EventList({ rows }: { rows: EventRow[] }) {
  const { t, i18n } = useTranslation();
  return (
    <ul className="divide-y divide-line">
      {rows.map(({ item, days }, i) => {
        const d = item.date ? isoToDate(item.date) : null;
        return (
          <li key={`${item.id ?? ''}-${i}`} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="break-words text-base font-semibold text-fg" dir="auto">
                {item.label || item.id}
              </div>
              <div className="text-sm text-muted" dir="auto">
                {d ? formatDate(d, i18n.language) : (item.date ?? '')}
                {item.notes ? ` — ${item.notes}` : ''}
              </div>
            </div>
            <div className="shrink-0">{daysBadge(days, t)}</div>
          </li>
        );
      })}
    </ul>
  );
}

/** Today in both calendars and the events the admin listed (upcoming first, past ones folded away). */
export default function CalendarCard({
  id,
  title,
  now,
  events,
  updatedAt,
  dataNow,
  className,
}: {
  id: string;
  title: string;
  now: Date;
  events: WidgetItem[];
  /** Stamp of the `events` group. */
  updatedAt: string | null;
  dataNow: number;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const { upcoming, past, undated } = splitEvents(events, palestineNow(now).date);
  const listed = [...upcoming, ...undated];

  return (
    <GroupCard
      id={id}
      title={title}
      icon={<CalendarDays className="h-5 w-5" aria-hidden />}
      chip="bg-danger-soft text-danger"
      subtitle={<UpdatedAgo at={updatedAt} now={dataNow} className="text-sm text-muted" />}
      className={className}
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <DateTile
          icon={<Moon className="h-6 w-6" aria-hidden />}
          label={t('widgets.calendar.hijri')}
          value={formatHijri(now, i18n.language)}
        />
        <DateTile
          icon={<CalendarDays className="h-6 w-6" aria-hidden />}
          label={t('widgets.calendar.gregorian')}
          value={formatGregorianLong(now, i18n.language)}
        />
      </div>

      <div>
        <h5 className="mb-1 flex items-center gap-1.5 text-base font-bold text-fg">
          <CalendarHeart className="h-4 w-4 text-danger" aria-hidden />
          {t('widgets.calendar.events')}
        </h5>
        {listed.length === 0 && past.length === 0 ? (
          <EmptyState title={t('widgets.calendar.noEvents')} />
        ) : (
          <>
            {listed.length === 0 ? (
              <p className="py-3 text-base text-muted">{t('widgets.calendar.noUpcoming')}</p>
            ) : (
              <EventList rows={listed} />
            )}
            {past.length > 0 && (
              <details className="mt-1 rounded-lg border border-line px-3">
                <summary className="cursor-pointer py-2 text-sm font-semibold text-fg">
                  {t('widgets.calendar.past', { count: past.length })}
                </summary>
                <EventList rows={past} />
              </details>
            )}
          </>
        )}
      </div>
    </GroupCard>
  );
}

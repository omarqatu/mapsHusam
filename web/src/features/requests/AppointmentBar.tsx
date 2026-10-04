import { useState } from 'react';
import clsx from 'clsx';
import { CalendarClock, Pencil, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSetAppointment, type ServiceRequest } from '@/api/requests';
import Button from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import {
  appointmentLabel,
  appointmentPresets,
  appointmentProblem,
  fromLocalInput,
  isViewingLayer,
  toLocalInput,
} from './appointment';
import { errorText } from './errors';

/**
 * The agreed time of the visit / viewing, at the top of an open chat: either side sets or moves it (the other side is
 * notified). One-tap usual times, or any date and time.
 */
export default function AppointmentBar({ req }: { req: ServiceRequest }) {
  const { t, i18n } = useTranslation();
  const save = useSetAppointment();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => (req.appointment_at ? toLocalInput(req.appointment_at) : ''));
  const viewing = isViewingLayer(req.service_layer);
  const at = req.appointment_at;

  const send = (iso: string | null) => {
    if (iso) {
      const problem = appointmentProblem(iso);
      if (problem) return toast.warning(t(`requests.appointment.${problem}`));
    }
    save.mutate(
      { id: req.id, at: iso },
      {
        onSuccess: () => {
          toast.success(t(iso ? 'requests.appointment.saved' : 'requests.appointment.cleared'));
          setEditing(false);
        },
        onError: (e) => toast.error(errorText(e, t('requests.appointment.failed'))),
      },
    );
  };

  return (
    <div
      className={clsx(
        'rounded-lg border p-2.5 text-sm',
        at ? 'border-brand/40 bg-brand-light/40' : 'border-line',
      )}
    >
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 shrink-0 text-brand-fg" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted">
            {t(viewing ? 'requests.appointment.viewing' : 'requests.appointment.visit')}
          </p>
          <p className={clsx('font-bold', at ? 'text-fg' : 'text-muted')}>
            {at ? appointmentLabel(at, i18n.language) : t('requests.appointment.none')}
          </p>
        </div>
        {!editing && (
          <Button
            size="sm"
            variant="secondary"
            startIcon={<Pencil className="h-3.5 w-3.5" aria-hidden />}
            onClick={() => setEditing(true)}
          >
            {t(at ? 'requests.appointment.change' : 'requests.appointment.set')}
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('requests.appointment.quick')}>
            {appointmentPresets().map((p) => (
              <button
                key={p.key}
                type="button"
                disabled={save.isPending}
                onClick={() => send(p.at.toISOString())}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-fg hover:border-brand hover:bg-brand-light"
              >
                {t(`requests.appointment.presets.${p.key}`)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <TextInput
                type="datetime-local"
                aria-label={t('requests.appointment.pick')}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              loading={save.isPending}
              disabled={!fromLocalInput(value)}
              onClick={() => send(fromLocalInput(value))}
            >
              {t('requests.appointment.save')}
            </Button>
          </div>
          <div className="flex justify-between gap-2">
            {at ? (
              <Button
                size="sm"
                variant="ghost"
                startIcon={<X className="h-3.5 w-3.5" aria-hidden />}
                onClick={() => send(null)}
              >
                {t('requests.appointment.clear')}
              </Button>
            ) : (
              <span />
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

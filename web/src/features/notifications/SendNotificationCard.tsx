import { useMemo, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { sendNotification } from '@/api/notifications';
import { useSocket } from '@/api/socket';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import FormField from '@/components/ui/FormField';
import SearchInput from '@/components/ui/SearchInput';
import SectionCard from '@/components/ui/SectionCard';
import SelectInput from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import TextareaInput from '@/components/ui/TextareaInput';
import { toast } from '@/components/ui/toastStore';
import { useAdminUsers } from '@/features/admin-users/hooks/useAdminUsers';
import { errorText } from '@/lib/errorText';
import type { Role } from '@/types/auth';
import {
  EMPTY_SEND,
  NOTIFY_TYPES,
  TARGET_TYPES,
  TITLE_MAX,
  toPayload,
  validateSend,
  type SendErrors,
  type SendForm,
} from './sendModel';

type RoleFilter = 'all' | Role;
const ROLE_FILTERS: RoleFilter[] = ['all', 'user', 'provider', 'admin'];

/**
 * Admin only: send a notification to one user, everyone online, everyone, one role, or a hand-picked list (legacy
 * notifications-panel.html). It goes over the socket; the server re-checks the role, saves it for people who are offline
 * and pushes it live to those who are online.
 */
export default function SendNotificationCard() {
  const { t } = useTranslation();
  const socket = useSocket();
  const [form, setForm] = useState<SendForm>(EMPTY_SEND);
  const [errors, setErrors] = useState<SendErrors>({});
  const [sending, setSending] = useState(false);
  const set = <K extends keyof SendForm>(key: K, value: SendForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key === 'target' ? 'userId' : key]: undefined }));
  };
  const message = (key: keyof SendErrors) =>
    errors[key] ? t(`notify.errors.${key}.${errors[key]}`) : undefined;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateSend(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!socket) return toast.error(t('notify.offline'));
    setSending(true);
    try {
      const res = await sendNotification(socket, toPayload(form));
      toast.success(t('notify.sent', { sent: res.sentCount, total: res.totalTargeted }));
      setForm((f) => ({ ...f, title: '', message: '' }));
    } catch (err) {
      toast.error(errorText(err, t('notify.failed')));
    } finally {
      setSending(false);
    }
  }

  return (
    <SectionCard title={t('notify.title')} icon={<Send className="h-5 w-5" aria-hidden />} className="mb-6">
      <form onSubmit={onSubmit} noValidate className="grid gap-x-4 sm:grid-cols-2">
        <FormField label={t('notify.target')} name="notify-target">
          <SelectInput
            id="notify-target"
            value={form.target}
            onChange={(e) => set('target', e.target.value as SendForm['target'])}
            options={TARGET_TYPES.map((v) => ({ value: v, label: t(`notify.targets.${v}`) }))}
          />
        </FormField>
        <FormField label={t('notify.type')} name="notify-type">
          <SelectInput
            id="notify-type"
            value={form.type}
            onChange={(e) => set('type', e.target.value as SendForm['type'])}
            options={NOTIFY_TYPES.map((v) => ({ value: v, label: t(`notify.types.${v}`) }))}
          />
        </FormField>

        {form.target === 'single' && (
          <FormField
            label={t('notify.userId')}
            name="notify-user"
            required
            error={message('userId')}
            className="sm:col-span-2"
          >
            <TextInput
              id="notify-user"
              inputMode="numeric"
              dir="ltr"
              value={form.userId}
              hasError={!!errors.userId}
              onChange={(e) => set('userId', e.target.value)}
            />
          </FormField>
        )}
        {form.target === 'selected' && (
          <div className="sm:col-span-2">
            <UserPicker selected={form.selected} onChange={(ids) => set('selected', ids)} />
            {errors.selected && (
              <p role="alert" className="mt-1 text-sm font-medium text-danger">
                {message('selected')}
              </p>
            )}
          </div>
        )}

        <FormField
          label={t('notify.titleLabel')}
          name="notify-title"
          required
          error={message('title')}
          className="sm:col-span-2"
        >
          <TextInput
            id="notify-title"
            maxLength={TITLE_MAX}
            value={form.title}
            hasError={!!errors.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </FormField>
        <FormField
          label={t('notify.message')}
          name="notify-message"
          required
          error={message('message')}
          className="sm:col-span-2"
        >
          <TextareaInput
            id="notify-message"
            rows={3}
            value={form.message}
            hasError={!!errors.message}
            onChange={(e) => set('message', e.target.value)}
          />
        </FormField>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            loading={sending}
            startIcon={<Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />}
          >
            {t('notify.send')}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

/** The "hand-picked" list: every account with a role filter, a name / phone search, select all / none and a count. */
function UserPicker({ selected, onChange }: { selected: number[]; onChange: (ids: number[]) => void }) {
  const { t } = useTranslation();
  const users = useAdminUsers();
  const [role, setRole] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim();
    return (users.data ?? []).filter(
      (u) =>
        (role === 'all' || u.role === role) &&
        (!q || (u.full_name ?? '').includes(q) || (u.phone ?? '').includes(q) || String(u.user_id) === q),
    );
  }, [users.data, role, query]);
  const chosen = new Set(selected);
  const toggle = (id: number, on: boolean) =>
    onChange(on ? [...selected, id] : selected.filter((x) => x !== id));

  return (
    <fieldset className="mb-4 rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-semibold text-fg">{t('notify.pick')}</legend>
      <div className="mb-2 flex flex-wrap gap-2">
        {ROLE_FILTERS.map((r) => (
          <Button
            key={r}
            type="button"
            size="sm"
            variant={role === r ? 'primary' : 'secondary'}
            onClick={() => setRole(r)}
          >
            {t(`notify.roles.${r}`)}
          </Button>
        ))}
      </div>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={t('notify.searchUsers')}
      />
      <div className="my-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChange([...new Set([...selected, ...shown.map((u) => u.user_id)])])}
        >
          {t('notify.selectShown')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
          {t('notify.clear')}
        </Button>
        <span className="text-sm text-muted" role="status">
          {t('notify.selectedCount', { count: selected.length })}
        </span>
      </div>
      <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg bg-subtle p-2">
        {users.isLoading && <li className="text-sm text-muted">{t('app.loading')}</li>}
        {shown.map((u) => (
          <li key={u.user_id}>
            <Checkbox
              checked={chosen.has(u.user_id)}
              onChange={(on) => toggle(u.user_id, on)}
              label={
                <span>
                  {u.full_name || '—'}{' '}
                  <span className="text-muted">
                    · {t(`roles.${u.role}`)} · #{u.user_id}
                  </span>
                </span>
              }
            />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

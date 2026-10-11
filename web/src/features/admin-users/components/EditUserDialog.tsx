import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { REQUEST_PERIODS, type AdminUser } from '@/api/adminUsers';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import FormField from '@/components/ui/FormField';
import Modal from '@/components/ui/Modal';
import SelectInput from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import { errorText } from '@/lib/errorText';
import { useAuthStore } from '@/store/authStore';
import { REAL_ESTATE_LAYERS, SERVICE_TYPES } from '@/features/map/config';
import { serviceLabelKey } from '@/features/map/registry';
import { targetLabelKey } from '@/features/map/targets';
import { useUpdateUser } from '../hooks/useAdminUsers';
import { buildUpdate, formFromUser, MIN_PASSWORD, validateForm, type EditForm } from '../model';

/** Edit one account: activation, role, service link, request quota, new password. Only changed fields are sent. */
export default function EditUserDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user?.user_id);
  const update = useUpdateUser();
  const [form, setForm] = useState<EditForm>(() => formFromUser(user));
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState('');
  const errors = validateForm(form);
  const hasErrors = Object.keys(errors).length > 0;
  const set = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const layerOptions = useMemo(
    () => [
      { value: '', label: t('adminUsers.edit.notLinked') },
      ...REAL_ESTATE_LAYERS.map((layer) => ({
        value: layer.typeName,
        label: `${t(targetLabelKey({ kind: 'realEstate', layer: layer.key }))} — ${layer.typeName}`,
      })),
      ...SERVICE_TYPES.map((s) => ({ value: s.key, label: `${t(serviceLabelKey(s.key))} — ${s.key}` })),
    ],
    [t],
  );

  const isSelf = user.user_id === me;
  const selfRisk = isSelf && (!form.is_active || form.role !== 'admin');
  const providerNeedsLink = form.role === 'provider' && !form.listing_links.some((link) => link.service_layer && link.feature_id.trim());

  const save = () => {
    setTried(true);
    setServerError('');
    if (hasErrors) return;
    const body = buildUpdate(user, form);
    if (!body) {
      setServerError(t('adminUsers.edit.noChanges'));
      return;
    }
    update.mutate(body, {
      onSuccess: () => {
        toast.success(t('adminUsers.toast.updated'));
        onClose();
      },
      onError: (e) => setServerError(errorText(e, t('errors.generic'))),
    });
  };

  const err = (key: keyof typeof errors, msgKey: string) =>
    tried && errors[key] ? t(msgKey, { min: MIN_PASSWORD }) : undefined;

  return (
    <Modal
      open
      onClose={update.isPending ? () => undefined : onClose}
      title={t('adminUsers.edit.title')}
      widthClass="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} loading={update.isPending}>
            {t('adminUsers.edit.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-subtle p-3 text-sm">
          <div>
            <span className="text-muted">{t('adminUsers.edit.user')}: </span>
            <strong className="text-fg">{user.full_name || t('adminUsers.noName')}</strong>
          </div>
          <div dir="ltr" className="font-mono text-muted">
            ID {user.user_id}
          </div>
        </div>

        {serverError && <AlertMessage type="error" message={serverError} />}
        {selfRisk && <AlertMessage type="warning" message={t('adminUsers.edit.selfWarning')} />}

        <section className="space-y-1">
          <Checkbox
            label={<strong>{t('adminUsers.edit.active')}</strong>}
            checked={form.is_active}
            onChange={(v) => set('is_active', v)}
          />
          <p className="text-sm text-muted">{t('adminUsers.edit.activeHint')}</p>
        </section>

        <FormField label={t('adminUsers.edit.role')} name="edit-role">
          <SelectInput
            id="edit-role"
            value={form.role}
            onChange={(e) => set('role', e.target.value as EditForm['role'])}
            options={(['user', 'provider', 'admin'] as const).map((r) => ({
              value: r,
              label: t(`roles.${r}`),
            }))}
          />
        </FormField>
        {providerNeedsLink && <AlertMessage type="info" message={t('adminUsers.edit.providerHint')} />}

        <fieldset className="space-y-3 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-bold text-fg">
            {t('adminUsers.edit.serviceLink')}
          </legend>
          {form.listing_links.map((link, index) => (
            <div key={index} className="flex items-end gap-2 rounded-lg bg-subtle p-2">
              <div className="min-w-0 flex-1 space-y-2">
                <FormField label={t('adminUsers.edit.layer')} name={`edit-layer-${index}`}>
                  <SelectInput
                    id={`edit-layer-${index}`}
                    searchable
                    value={link.service_layer}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        listing_links: f.listing_links.map((item, i) =>
                          i === index
                            ? { ...item, service_layer: e.target.value, feature_id: e.target.value ? item.feature_id : '' }
                            : item,
                        ),
                      }))
                    }
                    options={layerOptions}
                  />
                </FormField>
                {link.service_layer && (
                  <FormField
                    label={t('adminUsers.edit.featureId')}
                    name={`edit-feature-${index}`}
                    error={err('listing_links', 'adminUsers.edit.errors.integer')}
                  >
                    <TextInput
                      id={`edit-feature-${index}`}
                      inputMode="numeric"
                      dir="ltr"
                      value={link.feature_id}
                      hasError={tried && !!errors.listing_links}
                      placeholder={t('adminUsers.edit.featureIdPlaceholder')}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          listing_links: f.listing_links.map((item, i) =>
                            i === index ? { ...item, feature_id: e.target.value } : item,
                          ),
                        }))
                      }
                    />
                  </FormField>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('adminUsers.edit.removeLink')}
                onClick={() => setForm((f) => ({ ...f, listing_links: f.listing_links.filter((_, i) => i !== index) }))}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))}
          {tried && errors.listing_links && (
            <p className="text-sm text-danger">{t('adminUsers.edit.errors.integer')}</p>
          )}
          <p className="text-sm text-muted">{t('adminUsers.edit.featureIdHint')}</p>
          <Button
            variant="secondary"
            size="sm"
            startIcon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() =>
              setForm((f) => ({ ...f, listing_links: [...f.listing_links, { service_layer: '', feature_id: '' }] }))
            }
          >
            {t('adminUsers.edit.addLink')}
          </Button>
        </fieldset>

        <fieldset className="space-y-1 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-bold text-fg">{t('adminUsers.edit.quota')}</legend>
          <FormField
            label={t('adminUsers.edit.limit')}
            name="edit-limit"
            error={err('request_limit', 'adminUsers.edit.errors.limit')}
          >
            <TextInput
              id="edit-limit"
              inputMode="numeric"
              dir="ltr"
              value={form.request_limit}
              hasError={tried && !!errors.request_limit}
              placeholder={t('adminUsers.edit.limitPlaceholder')}
              onChange={(e) => set('request_limit', e.target.value)}
            />
          </FormField>
          <p className="text-sm text-muted">{t('adminUsers.edit.limitHint')}</p>
          <FormField label={t('adminUsers.edit.period')} name="edit-period">
            <SelectInput
              id="edit-period"
              disabled={!form.request_limit.trim()}
              value={form.request_limit_period}
              onChange={(e) =>
                set('request_limit_period', e.target.value as EditForm['request_limit_period'])
              }
              options={REQUEST_PERIODS.map((p) => ({ value: p, label: t(`adminUsers.period.${p}`) }))}
            />
          </FormField>
        </fieldset>

        <fieldset className="space-y-1 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-bold text-fg">{t('adminUsers.edit.password')}</legend>
          <FormField
            label={t('adminUsers.edit.newPassword')}
            name="edit-password"
            error={err('new_password', 'adminUsers.edit.errors.password')}
          >
            <TextInput
              id="edit-password"
              autoComplete="off"
              dir="ltr"
              value={form.new_password}
              hasError={tried && !!errors.new_password}
              placeholder={t('adminUsers.edit.newPasswordPlaceholder')}
              onChange={(e) => set('new_password', e.target.value)}
            />
          </FormField>
          <p className="text-sm text-muted">{t('adminUsers.edit.passwordHint', { min: MIN_PASSWORD })}</p>
        </fieldset>
      </div>
    </Modal>
  );
}

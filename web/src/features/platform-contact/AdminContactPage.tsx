import { useState } from 'react';
import { AtSign, Headset, Mail, MessageCircle, Phone, Save, Share2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import { errorText } from '@/lib/errorText';
import { formatDateTime } from '@/lib/format';
import {
  SOCIAL_KEYS,
  cleanPhone,
  isEmail,
  safeUrl,
  serializeContact,
  whatsappDigits,
  type PlatformContact,
  type SocialKey,
} from './model';
import SocialIcon from './SocialIcon';
import { usePlatformContactQuery, useSaveContact } from './queries';

type Errors = Partial<Record<'phone' | 'whatsapp' | 'email' | SocialKey, string>>;

function validate(c: PlatformContact, t: (k: string) => string): Errors {
  const e: Errors = {};
  if (c.phone && !cleanPhone(c.phone)) e.phone = t('platformContact.admin.badPhone');
  if (c.whatsapp && !whatsappDigits(c.whatsapp)) e.whatsapp = t('platformContact.admin.badPhone');
  if (c.email && !isEmail(c.email)) e.email = t('platformContact.admin.badEmail');
  for (const k of SOCIAL_KEYS)
    if (c.social[k] && !safeUrl(c.social[k])) e[k] = t('platformContact.admin.badUrl');
  return e;
}

/** `/admin/contact` — the platform's own WhatsApp, phone, email and social pages (footer + "contact us"). */
export default function AdminContactPage() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = usePlatformContactQuery();
  const save = useSaveContact();
  const [draft, setDraft] = useState<PlatformContact | null>(null);
  const [tried, setTried] = useState(false);

  if (isLoading) return <CenteredSpinner />;
  const saved = data?.contact;
  if (!saved) return <AlertMessage type="error" message={t('platformContact.admin.loadFailed')} />;
  const c = draft ?? saved;
  const dirty = serializeContact(c) !== serializeContact(saved);
  const errors = tried ? validate(c, t) : {};
  const set = (patch: Partial<PlatformContact>) => setDraft({ ...c, ...patch });
  const setSocial = (k: SocialKey, v: string) => setDraft({ ...c, social: { ...c.social, [k]: v } });

  const onSave = () => {
    setTried(true);
    if (Object.keys(validate(c, t)).length) return;
    const clean: PlatformContact = {
      phone: cleanPhone(c.phone),
      whatsapp: c.whatsapp.trim(),
      email: c.email.trim(),
      social: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, safeUrl(c.social[k].trim())])) as Record<
        SocialKey,
        string
      >,
    };
    save.mutate(clean, {
      onSuccess: () => {
        toast.success(t('platformContact.admin.saved'));
        setDraft(null);
        setTried(false);
      },
      onError: (e) => toast.error(errorText(e, t('platformContact.admin.failed'))),
    });
  };

  const field = (
    key: 'phone' | 'whatsapp' | 'email',
    icon: React.ReactNode,
    type: 'tel' | 'email',
    placeholder: string,
  ) => (
    <FormField label={t(`platformContact.${key}`)} name={`contact-${key}`} error={errors[key]}>
      {/* Numbers and addresses read left to right: the whole box is LTR, so the icon sits beside the text. */}
      <div dir="ltr">
        <TextInput
          id={`contact-${key}`}
          type={type}
          inputMode={type === 'tel' ? 'tel' : 'email'}
          startIcon={icon}
          placeholder={placeholder}
          value={c[key]}
          hasError={!!errors[key]}
          onChange={(e) => set({ [key]: e.target.value })}
        />
      </div>
    </FormField>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Headset className="h-6 w-6" aria-hidden />}
        title={t('platformContact.admin.title')}
        description={t('platformContact.admin.description')}
        actions={
          <>
            {dirty && (
              <Button
                variant="ghost"
                startIcon={<Undo2 className="h-4 w-4" aria-hidden />}
                onClick={() => setDraft(null)}
              >
                {t('platformContact.admin.discard')}
              </Button>
            )}
            <Button
              startIcon={<Save className="h-4 w-4" aria-hidden />}
              disabled={!dirty}
              loading={save.isPending}
              onClick={onSave}
            >
              {t('common.save')}
            </Button>
          </>
        }
      />
      {isError && <AlertMessage type="error" message={t('platformContact.admin.loadFailed')} />}
      {data?.updatedAt && !dirty && (
        <p className="text-sm text-muted">
          {t('platformContact.admin.updatedAt', { date: formatDateTime(data.updatedAt, i18n.language) })}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title={t('platformContact.admin.direct')}
          icon={<Phone className="h-5 w-5" aria-hidden />}
        >
          <p className="text-sm text-muted">{t('platformContact.admin.directHint')}</p>
          {field('whatsapp', <MessageCircle className="h-4 w-4" aria-hidden />, 'tel', '0599 000 000')}
          {field('phone', <Phone className="h-4 w-4" aria-hidden />, 'tel', '02 000 0000')}
          {field('email', <Mail className="h-4 w-4" aria-hidden />, 'email', 'info@example.com')}
        </SectionCard>

        <SectionCard
          title={t('platformContact.admin.social')}
          icon={<Share2 className="h-5 w-5" aria-hidden />}
        >
          <p className="text-sm text-muted">{t('platformContact.admin.socialHint')}</p>
          {SOCIAL_KEYS.map((k) => (
            <FormField key={k} label={t(`footer.social.${k}`)} name={`contact-${k}`} error={errors[k]}>
              <div dir="ltr">
                <TextInput
                  id={`contact-${k}`}
                  type="url"
                  inputMode="url"
                  startIcon={<SocialIcon name={k} />}
                  placeholder="https://"
                  value={c.social[k]}
                  hasError={!!errors[k]}
                  onChange={(e) => setSocial(k, e.target.value)}
                />
              </div>
            </FormField>
          ))}
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <AtSign className="h-3.5 w-3.5" aria-hidden />
            {t('platformContact.admin.emptyHidden')}
          </p>
        </SectionCard>
      </div>
    </div>
  );
}

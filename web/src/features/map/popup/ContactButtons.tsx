import clsx from 'clsx';
import { Lock, MessageCircle, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { useLoginPrompt } from '@/features/auth/loginPromptStore';
import { useCanSeeContact } from '@/features/visibility/store';

interface Props {
  phone: string;
  whatsapp: string;
  onCall: () => void;
  onWhatsapp: () => void;
  /**
   * `card`: full-width stacked, number shown; `row`: small side-by-side (result lists); `wide`: the main action of a
   * listing — big, side by side, sharing the full width.
   */
  layout: 'card' | 'row' | 'wide';
  className?: string;
}

/**
 * Call + WhatsApp buttons — one look everywhere a provider can be contacted. Renders nothing without a number.
 * A visitor without an account gets no numbers from the server (unless the admin allows it): one "log in to contact"
 * button instead, which opens the login sheet.
 */
export default function ContactButtons({ phone, whatsapp, onCall, onWhatsapp, layout, className }: Props) {
  const { t } = useTranslation();
  const canSee = useCanSeeContact();
  const openLogin = useLoginPrompt((s) => s.open);
  const card = layout === 'card';
  const wide = layout === 'wide';
  const size = card || wide ? 'md' : 'sm';
  const icon = card || wide ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const full = card || wide ? 'w-full' : undefined;
  if (!canSee)
    return (
      <div className={clsx('flex', className)}>
        <Button
          size={size}
          variant={wide ? 'primary' : 'secondary'}
          className={full}
          startIcon={<Lock className={icon} aria-hidden />}
          onClick={() => openLogin('contact')}
        >
          {t('loginPrompt.contactButton')}
        </Button>
      </div>
    );
  if (!phone && !whatsapp) return null;
  return (
    <div className={clsx('flex gap-2', card && 'flex-col', wide && '[&>*]:flex-1', className)}>
      {phone && (
        <Button
          size={size}
          className={full}
          startIcon={<Phone className={icon} aria-hidden />}
          onClick={onCall}
        >
          {t('popup.call')}
          {card && <span dir="ltr">{phone}</span>}
        </Button>
      )}
      {whatsapp && (
        <Button
          size={size}
          variant="whatsapp"
          className={full}
          startIcon={<MessageCircle className={icon} aria-hidden />}
          onClick={onWhatsapp}
        >
          {t('popup.whatsapp')}
        </Button>
      )}
    </div>
  );
}

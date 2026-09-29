import clsx from 'clsx';
import { MessageCircle, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';

interface Props {
  phone: string;
  whatsapp: string;
  onCall: () => void;
  onWhatsapp: () => void;
  /** `card`: full-width stacked, number shown; `row`: small side-by-side (result lists). */
  layout: 'card' | 'row';
  className?: string;
}

/** Call + WhatsApp buttons — one look everywhere a provider can be contacted. Renders nothing without a number. */
export default function ContactButtons({ phone, whatsapp, onCall, onWhatsapp, layout, className }: Props) {
  const { t } = useTranslation();
  if (!phone && !whatsapp) return null;
  const card = layout === 'card';
  const size = card ? 'md' : 'sm';
  const icon = card ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <div className={clsx('flex gap-2', card && 'flex-col', className)}>
      {phone && (
        <Button
          size={size}
          className={card ? 'w-full' : undefined}
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
          className={card ? 'w-full' : undefined}
          startIcon={<MessageCircle className={icon} aria-hidden />}
          onClick={onWhatsapp}
        >
          {t('popup.whatsapp')}
        </Button>
      )}
    </div>
  );
}

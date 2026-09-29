import { MessageCircle, Phone, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProviderLinked } from '@/api/mapEvents';
import { text } from '../popup/featureModel';
import { useContactActions } from '../popup/useContactActions';
import { targetLabelKey } from '../targets';
import { toSelected, type SearchResult } from './results';

interface Props {
  r: SearchResult;
  /** Wrapper classes (layout differs between a result row and a featured card). */
  className?: string;
  /** A provider with a registered account is contacted through a service request; show that (disabled until ported). */
  showRequest?: boolean;
}

/** Call / WhatsApp buttons of one result (never for road checkpoints; registered providers use "request service"). */
export default function ResultContact({ r, className, showRequest }: Props) {
  const { t } = useTranslation();
  const linked = useProviderLinked();
  const contact = useContactActions();
  const p = r.props;
  const phone = text(p.phone);
  const whatsapp = text(p.whatsapp);
  const isRe = r.target.kind === 'realEstate';
  const isLinked =
    r.target.kind === 'service' && !!r.id && !!linked.data?.get(r.target.discriminator)?.has(r.id);
  const isBarrier = r.target.kind === 'service' && r.target.discriminator === 'road_barriers';
  if (isBarrier) return null;

  if (isLinked) {
    if (!showRequest) return null;
    return (
      <div className={className}>
        <button
          type="button"
          disabled
          title={t('popup.requestSoon')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white opacity-60"
        >
          <Send className="h-3.5 w-3.5" aria-hidden /> {t('popup.requestService')}
        </button>
      </div>
    );
  }
  if (!phone && !whatsapp) return null;

  const providerName = text(p.name) || t(isRe ? 'popup.advertiser' : 'popup.provider');
  const typeTitle = t(targetLabelKey(r.target));
  return (
    <div className={className}>
      {phone && (
        <button
          type="button"
          onClick={() => void contact.call(toSelected(r), providerName, phone)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden /> {t('popup.call')}
        </button>
      )}
      {whatsapp && (
        <button
          type="button"
          onClick={() => void contact.whatsapp(toSelected(r), providerName, whatsapp, typeTitle)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1fb956]"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden /> {t('popup.whatsapp')}
        </button>
      )}
    </div>
  );
}

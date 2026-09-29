import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProviderLinked } from '@/api/mapEvents';
import Button from '@/components/ui/Button';
import ContactButtons from '../popup/ContactButtons';
import { text } from '../popup/featureModel';
import { useContactActions } from '../popup/useContactActions';
import { isRoadBarrier, targetLabelKey } from '../targets';
import { toSelected, type SearchResult } from './results';

interface Props {
  r: SearchResult;
  /** Wrapper classes (layout differs between a result row and a featured card). */
  className?: string;
  /** A provider with a registered account is contacted through a service request; show that (disabled until ported). */
  showRequest?: boolean;
}

/**
 * Contact for one result (rows, featured cards): decides WHETHER and HOW to contact — never road checkpoints,
 * registered providers get "request service" — and renders the shared ContactButtons.
 */
export default function ResultContact({ r, className, showRequest }: Props) {
  const { t } = useTranslation();
  const linked = useProviderLinked();
  const contact = useContactActions();
  const p = r.props;
  if (isRoadBarrier(r.target)) return null;

  const isLinked =
    r.target.kind === 'service' && !!r.id && !!linked.data?.get(r.target.discriminator)?.has(r.id);
  if (isLinked) {
    if (!showRequest) return null;
    return (
      <div className={className}>
        <Button
          size="sm"
          disabled
          title={t('popup.requestSoon')}
          startIcon={<Send className="h-3.5 w-3.5" aria-hidden />}
        >
          {t('popup.requestService')}
        </Button>
      </div>
    );
  }

  const phone = text(p.phone);
  const whatsapp = text(p.whatsapp);
  const providerName =
    text(p.name) || t(r.target.kind === 'realEstate' ? 'popup.advertiser' : 'popup.provider');
  return (
    <ContactButtons
      layout="row"
      className={className}
      phone={phone}
      whatsapp={whatsapp}
      onCall={() => void contact.call(toSelected(r), providerName, phone)}
      onWhatsapp={() =>
        void contact.whatsapp(toSelected(r), providerName, whatsapp, t(targetLabelKey(r.target)))
      }
    />
  );
}

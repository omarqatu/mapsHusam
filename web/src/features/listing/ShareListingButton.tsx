import { Link2, MessageCircle, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonClass';
import { toast } from '@/components/ui/toastStore';
import { copyText, nativeShare } from '@/lib/clipboard';
import { whatsappShareLink } from './link';

/**
 * Share one listing: the phone's share sheet where there is one (WhatsApp, Facebook, Messenger… in one tap); elsewhere
 * WhatsApp with a ready message, and "copy link". The link opens the listing's own page, with a picture preview.
 */
export default function ShareListingButton({ title, url }: { title: string; url: string }) {
  const { t } = useTranslation();
  if (typeof navigator.share === 'function')
    return (
      <Button
        variant="secondary"
        size="sm"
        startIcon={<Share2 className="h-4 w-4" aria-hidden />}
        onClick={() => void nativeShare({ title, url })}
      >
        {t('listing.share')}
      </Button>
    );
  return (
    <>
      <a
        href={whatsappShareLink(title, url)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass('secondary', 'sm')}
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        {t('listing.shareWhatsapp')}
      </a>
      <Button
        variant="secondary"
        size="sm"
        startIcon={<Link2 className="h-4 w-4" aria-hidden />}
        onClick={async () => {
          if (await copyText(url)) toast.success(t('listing.linkCopied'));
          else toast.error(t('popup.copyFailed'));
        }}
      >
        {t('listing.copyLink')}
      </Button>
    </>
  );
}

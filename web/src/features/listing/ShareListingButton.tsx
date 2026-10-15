import { useCallback, useRef, useState } from 'react';
import { Link2, MessageCircle, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import ActionTile from '@/components/ui/ActionTile';
import { toast } from '@/components/ui/toastStore';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { copyText, nativeShare } from '@/lib/clipboard';
import { whatsappShareLink } from './link';

const menuItem =
  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm font-semibold text-fg hover:bg-subtle';

/**
 * Share one listing: the phone's share sheet where there is one (WhatsApp, Facebook, Messenger… in one tap); elsewhere
 * one button with a small menu — WhatsApp with a ready message, or copy the link. The link opens the listing's own
 * page, with a picture preview. `tile`: the icon-over-label look of the listing's action row.
 */
export default function ShareListingButton({
  title,
  url,
  tile,
}: {
  title: string;
  url: string;
  tile?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(box, close, open);
  const native = typeof navigator.share === 'function';
  const label = t('listing.share');
  const onClick = () => (native ? void nativeShare({ title, url }) : setOpen((v) => !v));
  const trigger = tile ? (
    <ActionTile
      icon={<Share2 />}
      label={label}
      onClick={onClick}
      aria-expanded={native ? undefined : open}
      className="w-full"
    />
  ) : (
    <Button
      variant="secondary"
      size="sm"
      startIcon={<Share2 className="h-4 w-4" aria-hidden />}
      onClick={onClick}
      aria-expanded={native ? undefined : open}
    >
      {label}
    </Button>
  );
  return (
    <div ref={box} className="relative">
      {trigger}
      {open && (
        <div className="absolute end-0 bottom-full z-30 mb-1 w-52 rounded-xl border border-line bg-surface p-1 shadow-float">
          <a
            href={whatsappShareLink(title, url)}
            target="_blank"
            rel="noopener noreferrer"
            className={menuItem}
            onClick={close}
          >
            <MessageCircle className="h-4 w-4 text-whatsapp" aria-hidden />
            {t('listing.shareWhatsapp')}
          </a>
          <button
            type="button"
            className={menuItem}
            onClick={async () => {
              close();
              if (await copyText(url)) toast.success(t('listing.linkCopied'));
              else toast.error(t('popup.copyFailed'));
            }}
          >
            <Link2 className="h-4 w-4 text-muted" aria-hidden />
            {t('listing.copyLink')}
          </button>
        </div>
      )}
    </div>
  );
}

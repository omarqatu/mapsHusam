import { useRef } from 'react';
import { Download, MapPin, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import TargetIcon from '@/features/map/TargetIcon';
import type { MapTarget } from '../map/targets';
import QrCode from './QrCode';
import { listingUrl } from './link';

/**
 * A sticker for the provider's shop window or car: a QR code that opens the listing's own page, its name, and
 * «لاقيني على خريطة الخدمات». Printed from the browser, or saved as a picture (SVG) to send to a print shop.
 */
export default function QrSticker({
  target,
  id,
  name,
  onClose,
}: {
  target: MapTarget;
  id: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qr = useRef<SVGSVGElement>(null);
  const url = listingUrl(target, id);

  const download = () => {
    if (!qr.current) return;
    const blob = new Blob([new XMLSerializer().serializeToString(qr.current)], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${id}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('myListings.qr.title')}
      footer={
        <div className="flex flex-wrap justify-end gap-2 print:hidden">
          <Button
            variant="secondary"
            startIcon={<Download className="h-4 w-4" aria-hidden />}
            onClick={download}
          >
            {t('myListings.qr.download')}
          </Button>
          <Button startIcon={<Printer className="h-4 w-4" aria-hidden />} onClick={() => window.print()}>
            {t('myListings.qr.print')}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted print:hidden">{t('myListings.qr.hint')}</p>
      {/* The sticker itself: always light, so it prints the same in dark mode. */}
      <div
        data-print-sticker
        className="mx-auto max-w-xs rounded-2xl border-2 border-[#4f46e5] bg-white p-5 text-center text-[#111827]"
      >
        <p className="flex items-center justify-center gap-1.5 text-lg font-black text-[#4f46e5]">
          <MapPin className="h-5 w-5" aria-hidden /> {t('myListings.qr.findMe')}
        </p>
        <div className="mx-auto my-3 w-48">
          <QrCode ref={qr} text={url} label={t('myListings.qr.codeLabel', { name })} />
        </div>
        <p className="flex items-center justify-center gap-1.5 text-base font-bold" dir="auto">
          <span aria-hidden>
            <TargetIcon target={target} />
          </span>
          {name}
        </p>
        <p className="mt-1 text-xs text-[#4b5563]">{t('myListings.qr.scan')}</p>
      </div>
    </Modal>
  );
}

import { useEffect, useRef, useState } from 'react';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import { unByKey } from 'ol/Observable';
import VectorSource from 'ol/source/Vector';
import { Icon, Style } from 'ol/style';
import { Check, Copy, ExternalLink, Share2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import { DEFAULT_ZOOM, type Coordinate } from '../config';
import { useOlMap } from '../MapContext';
import { readSharedCenter, readSharedZoom } from '../mapUtils';
import MapSheet from '../panels/MapSheet';
import { useMapUi } from '../store';
import { copyText, isMobileBrowser, nativeShare } from './clipboard';
import {
  googleMapsLink,
  gridClipboard,
  gridDisplay,
  shareLink,
  wgsClipboard,
  wgsDisplay,
} from './share';

/** Red map pin, anchored by its tip (legacy loaded a PNG from a CDN; this one is inline). */
const PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">' +
  '<path d="M16 1C7.7 1 1 7.7 1 16c0 11 15 27 15 27s15-16 15-27C31 7.7 24.3 1 16 1z" fill="#e53935" stroke="#fff" stroke-width="2"/>' +
  '<circle cx="16" cy="16" r="6" fill="#fff"/></svg>';
const pinStyle = new Style({
  image: new Icon({
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PIN_SVG)}`,
    anchor: [0.5, 1],
  }),
});

/** The chosen location. `zoom` is what the link carries; `fromLink` = it came from an opened `?x=&y=` link. */
interface Picked {
  coord: Coordinate;
  zoom: number;
  fromLink: boolean;
}

type CopyKey = 'link' | 'grid' | 'wgs';

/** A coordinate value: always left-to-right, even inside an Arabic page. */
const Value = ({ children }: { children: string }) => (
  <span dir="ltr" className="inline-block font-mono text-xs text-slate-800">
    {children}
  </span>
);

function SharePanel({
  picked,
  onClear,
  onClose,
}: {
  picked: Picked | null;
  onClear: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<CopyKey | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const link = picked ? shareLink(window.location.origin, window.location.pathname, picked.coord, picked.zoom) : '';
  const canShare = isMobileBrowser() && typeof navigator.share === 'function';

  const flash = (key: CopyKey) => {
    setCopied(key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2000);
  };
  const copy = async (key: CopyKey, text: string) => {
    if (await copyText(text)) flash(key);
    else toast.error(t(key === 'link' ? 'tools.share.copyLinkFailed' : 'tools.share.copyCoordsFailed'));
  };
  const copyLink = async () => {
    if (!picked) return;
    // Phones: the share sheet, so the pasted link is not turned into a web search by some apps.
    if (canShare) return void (await nativeShare({ title: t('tools.share.shareTitle'), url: link }));
    await copy('link', link);
  };

  const copyLabel = (key: CopyKey, idle: string) =>
    copied === key ? (
      <>
        <Check className="h-4 w-4" aria-hidden /> {t('tools.share.copied')}
      </>
    ) : (
      <>
        <Copy className="h-4 w-4" aria-hidden /> {idle}
      </>
    );

  return (
    <MapSheet side="end" label={t('tools.share.title')} title={t('tools.share.title')} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600" role="status">
        {!picked
          ? t('tools.share.hint')
          : picked.fromLink
            ? t('tools.share.fromLink')
            : t('tools.share.selected')}
      </p>

      <TextInput
        readOnly
        inputSize="sm"
        value={link}
        placeholder={t('tools.share.linkPlaceholder')}
        aria-label={t('tools.share.copyLink')}
        onFocus={(e) => e.currentTarget.select()}
        className="text-xs"
      />
      <Button
        size="sm"
        className="mt-2 w-full"
        disabled={!picked}
        startIcon={canShare ? <Share2 className="h-4 w-4" aria-hidden /> : undefined}
        onClick={() => void copyLink()}
      >
        {canShare ? t('tools.share.shareLink') : copyLabel('link', t('tools.share.copyLink'))}
      </Button>

      <div className="mt-4 space-y-3 rounded-lg border border-dashed border-slate-300 p-3 text-xs">
        <div>
          <div className="font-bold text-slate-700">{t('tools.share.gridTitle')}</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <Value>{picked ? gridDisplay(picked.coord) : 'E: --- , N: ---'}</Value>
            <Button
              size="sm"
              variant="secondary"
              disabled={!picked}
              className="h-8 shrink-0 px-2 text-xs"
              onClick={() => picked && void copy('grid', gridClipboard(picked.coord))}
            >
              {copyLabel('grid', t('tools.share.copy'))}
            </Button>
          </div>
        </div>
        <div>
          <div className="font-bold text-slate-700">{t('tools.share.wgsTitle')}</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <Value>{picked ? wgsDisplay(picked.coord) : 'Lat: --- , Lon: ---'}</Value>
            <Button
              size="sm"
              variant="secondary"
              disabled={!picked}
              className="h-8 shrink-0 px-2 text-xs"
              onClick={() => picked && void copy('wgs', wgsClipboard(picked.coord))}
            >
              {copyLabel('wgs', t('tools.share.copy'))}
            </Button>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={!picked}
            className="mt-2 h-8 w-full text-xs"
            startIcon={<ExternalLink className="h-4 w-4" aria-hidden />}
            onClick={() => picked && window.open(googleMapsLink(picked.coord), '_blank', 'noopener,noreferrer')}
          >
            {t('tools.share.openGoogle')}
          </Button>
        </div>
      </div>

      <Button
        size="sm"
        variant="ghost"
        className="mt-3 w-full border border-slate-200"
        disabled={!picked}
        startIcon={<Trash2 className="h-4 w-4" aria-hidden />}
        onClick={onClear}
      >
        {t('tools.share.clear')}
      </Button>
    </MapSheet>
  );
}

/**
 * Share a location (legacy share-location.js): with the panel open a tap drops a pin and shows the link and both
 * coordinate systems. The pin stays after the panel closes, and an opened `?x=&y=&z=` link starts with its pin.
 */
export default function ShareTool() {
  const map = useOlMap();
  const open = useMapUi((s) => s.activeTool === 'share');
  const setActiveTool = useMapUi((s) => s.setActiveTool);
  const [source] = useState(() => new VectorSource());
  const [picked, setPicked] = useState<Picked | null>(() => {
    const coord = readSharedCenter(window.location.search);
    return coord ? { coord, zoom: readSharedZoom(window.location.search) ?? DEFAULT_ZOOM, fromLink: true } : null;
  });

  useEffect(() => {
    if (!map) return;
    const layer = new VectorLayer({ source, style: pinStyle, zIndex: 1960 });
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, source]);

  // The pin follows the chosen location.
  useEffect(() => {
    source.clear();
    if (picked) source.addFeature(new Feature(new Point(picked.coord)));
  }, [source, picked]);

  // A shared link carries a zoom; MapView already centres on the point.
  useEffect(() => {
    const z = readSharedZoom(window.location.search);
    if (map && z !== null && readSharedCenter(window.location.search)) map.getView().setZoom(z);
  }, [map]);

  // Taps choose a location only while the panel is open (SelectionController and search picking stand aside).
  useEffect(() => {
    if (!map || !open) return;
    const target = map.getTargetElement();
    target.style.cursor = 'crosshair';
    const key = map.on('singleclick', (e) => {
      setPicked({
        coord: e.coordinate as Coordinate,
        zoom: map.getView().getZoom() ?? DEFAULT_ZOOM,
        fromLink: false,
      });
    });
    return () => {
      unByKey(key);
      target.style.cursor = '';
    };
  }, [map, open]);

  if (!open) return null;
  return <SharePanel picked={picked} onClear={() => setPicked(null)} onClose={() => setActiveTool(null)} />;
}

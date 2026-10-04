import { Copy, Link2, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProviderLinked } from '@/api/mapEvents';
import RequestServiceButton from '@/features/requests/RequestServiceButton';
import { useSectionShown } from '@/features/visibility/store';
import Button from '@/components/ui/Button';
import DataField from '@/components/ui/DataField';

/** Public card: an empty field is left out instead of showing a dash. */
function Field(props: Parameters<typeof DataField>[0]) {
  return props.value === null || props.value === undefined || props.value === '' ? null : (
    <DataField {...props} />
  );
}
import MediaGallery from '@/components/ui/MediaGallery';
import StatusDot from '@/components/ui/StatusDot';
import { toast } from '@/components/ui/toastStore';
import clsx from 'clsx';
import MapSheet from '../panels/MapSheet';
import { FuelBadges } from '../extras/StatusBadges';
import {
  barrierDirections,
  collectMedia,
  hoursLabel,
  isOpenNow,
  labelMedia,
  locationShareLink,
  priceLabel,
  text,
  type SelectedFeature,
} from './featureModel';
import {
  hasPrice,
  isFuelStation,
  isRoadBarrier,
  priceCurrencyDefault,
  targetIcon,
  targetLabelKey,
} from '../targets';
import { copyText, isMobileBrowser, nativeShare } from '@/lib/clipboard';
import ContactButtons from './ContactButtons';
import { formatArea, formatLength } from '../tools/measure';
import RatingsBlock from './RatingsBlock';
import { useContactActions } from './useContactActions';

interface Props {
  feature: SelectedFeature;
  onClose: () => void;
  className?: string;
}

function StatusTile({ tone, label, sub }: { tone: string; label: string; sub?: string }) {
  return (
    <div
      className="rounded-lg border border-dashed p-3 text-center"
      style={{ borderColor: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)` }}
    >
      <div className="flex items-center justify-center gap-2 text-sm font-bold" style={{ color: tone }}>
        <StatusDot color={tone} /> {label}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function StatusPill({ tone, label, sub }: { tone: string; label: string; sub?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)` }}
    >
      <StatusDot color={tone} className="h-2 w-2" />
      {label}
      {sub && <span className="font-normal text-muted">· {sub}</span>}
    </span>
  );
}

/** "رام الله وسط البلد · رام الله · محافظة رام الله" → the first one alone: drop names another one already contains. */
function distinctPlaces(parts: string[]) {
  const all = [...new Set(parts.filter(Boolean))];
  return all.filter((p) => !all.some((o) => o !== p && o.includes(p))).join(' · ');
}

async function shareLocation(feature: SelectedFeature, title: string, t: (k: string) => string) {
  const url = locationShareLink(window.location.origin, window.location.pathname, feature.coordinate);
  // Phones: native share sheet (closing it is not an error). Elsewhere: clipboard.
  if (isMobileBrowser() && (await nativeShare({ title, url }))) return;
  if (isMobileBrowser() && typeof navigator.share === 'function') return;
  if (await copyText(url)) toast.success(t('popup.linkCopied'));
  else toast.error(t('popup.copyFailed'));
}

/** Details of the clicked marker (legacy popup.js generateFeatureHtml), as a React card. */
export default function FeatureCard({ feature, onClose, className }: Props) {
  const { t, i18n } = useTranslation();
  const linked = useProviderLinked();
  const contact = useContactActions();
  const requestsOn = useSectionShown('requests');
  const { props, kind, id } = feature;

  const isBarrier = isRoadBarrier(kind);
  const typeTitle = kind.kind === 'location' ? t('popup.sharedLocation') : t(targetLabelKey(kind));
  const name = text(props.name);
  const providerName = name || (kind.kind === 'realEstate' ? t('popup.advertiser') : t('popup.provider'));
  const place = text(props.location_name) || text(props.location);
  const media = labelMedia(collectMedia(props), t);
  const hoursText = hoursLabel(props.work_hours, t, i18n.language);
  const open = isOpenNow(props.auto_status);

  const whatsapp = text(props.whatsapp);
  const phone = text(props.phone);
  // With requests switched off (admin) a registered provider is contacted like any other: call / WhatsApp.
  const isLinkedProvider =
    requestsOn && kind.kind === 'service' && !!id && !!linked.data?.get(kind.discriminator)?.has(id);
  const dirs = isBarrier ? barrierDirections(props) : null;

  // The header already shows the name; the body shows where it is, then only what is filled in.
  const where = distinctPlaces([place, text(props.village_a), text(props.gov_a)]);
  // Property, and the services priced like it (hotels, holiday villas: dollars).
  const priced = hasPrice(kind);
  const price = priced ? priceLabel(props, t, i18n.language, priceCurrencyDefault(kind)) : null;
  const area = priced && Number(text(props.area)) > 0 ? `${text(props.area)} ${t('map.areaUnit')}` : null;
  const measure = feature.measure
    ? feature.measure.kind === 'area'
      ? formatArea(feature.measure.squareMeters, t)
      : formatLength(feature.measure.meters, t)
    : null;
  const description = text(props.des);
  const hasDetails = !!(where || price || area || measure || description);

  return (
    <MapSheet
      dragId="card"
      side="start"
      className={clsx('[--glass-opacity:90%] [--glass-tint-amount:0%]', className)}
      label={typeTitle}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          {kind.kind === 'location' ? (
            <MapPin className="h-6 w-6 text-danger" aria-hidden />
          ) : (
            <span aria-hidden className="text-xl">
              {targetIcon(kind)}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm">{name || typeTitle}</div>
            {name && (
              <div className="truncate text-xs font-normal text-muted">
                {typeTitle}
                {id ? ` · #${id}` : ''}
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {kind.kind === 'location' && <p className="text-sm text-muted">{t('popup.sharedLocationHint')}</p>}

        {dirs && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-center text-xs text-muted">{t('popup.inbound')}</div>
              <StatusTile tone={dirs.inbound.color} label={t(`roadStatus.${dirs.inbound.key}`)} />
            </div>
            <div>
              <div className="mb-1 text-center text-xs text-muted">{t('popup.outbound')}</div>
              {dirs.outbound ? (
                <StatusTile tone={dirs.outbound.color} label={t(`roadStatus.${dirs.outbound.key}`)} />
              ) : (
                <StatusTile tone="var(--color-muted)" label={t('popup.notSet')} />
              )}
            </div>
          </div>
        )}

        {/* One line: open / closed (+ hours) and the rating summary. */}
        {kind.kind !== 'location' && !isBarrier && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <StatusPill
              tone={open ? 'var(--color-ok)' : 'var(--color-danger)'}
              label={open ? t('popup.openNow') : t('popup.closedNow')}
              sub={hoursText}
            />
            {kind.kind === 'service' && id && <RatingsBlock layer={kind.discriminator} featureId={id} />}
          </div>
        )}

        {/* Contact first: it is what people open a card for. */}
        {kind.kind !== 'location' &&
          !isBarrier &&
          (isLinkedProvider ? (
            // Registered providers are contacted through a service request (chat).
            <RequestServiceButton
              className="w-full"
              target={{
                serviceLayer: kind.kind === 'service' ? kind.discriminator : '',
                featureId: id ?? '',
                providerName,
                serviceType: typeTitle,
              }}
            />
          ) : (
            <ContactButtons
              layout="card"
              phone={phone}
              whatsapp={whatsapp}
              onCall={() => void contact.call(feature, providerName, phone)}
              onWhatsapp={() => void contact.whatsapp(feature, providerName, whatsapp, typeTitle)}
            />
          ))}

        {kind.kind !== 'location' && !isBarrier && !isLinkedProvider && !phone && !whatsapp && (
          <p className="text-sm text-muted">{t('popup.noContact')}</p>
        )}

        {kind.kind !== 'location' && (hasDetails || isFuelStation(kind)) && (
          <div className="space-y-3 rounded-lg border border-line p-3">
            {where && (
              <p className="flex items-start gap-1.5 text-sm text-fg">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                {where}
              </p>
            )}
            {(price || area || measure) && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('popup.price')} value={price} />
                <Field label={t('popup.area')} value={area} />
                <Field
                  wide
                  label={feature.measure?.kind === 'area' ? t('popup.mapArea') : t('popup.mapLength')}
                  value={measure}
                />
              </div>
            )}
            {description && (
              <Field label={isBarrier ? t('popup.notes') : t('popup.description')} value={description} wide />
            )}
            {isFuelStation(kind) && <FuelBadges props={props} />}
          </div>
        )}

        {media.length > 0 && <MediaGallery items={media} />}

        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <Button
            variant="secondary"
            size="sm"
            startIcon={
              typeof navigator.share === 'function' ? (
                <Link2 className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )
            }
            onClick={() => void shareLocation(feature, typeTitle, t)}
          >
            {t('popup.copyLink')}
          </Button>
          <span className="text-xs text-muted" dir="ltr">
            {feature.coordinate.map((n) => n.toFixed(1)).join(', ')}
          </span>
        </div>
      </div>
    </MapSheet>
  );
}

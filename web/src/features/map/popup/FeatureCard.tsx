import { Copy, Info, Link2, MapPin, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProviderLinked } from '@/api/mapEvents';
import Button from '@/components/ui/Button';
import DataField from '@/components/ui/DataField';

/** Public card: an empty field is left out instead of showing a dash. */
function Field(props: Parameters<typeof DataField>[0]) {
  return props.value === null || props.value === undefined || props.value === '' ? null : (
    <DataField {...props} />
  );
}
import MediaGallery, { type MediaItem as GalleryItem } from '@/components/ui/MediaGallery';
import SectionCard from '@/components/ui/SectionCard';
import { toast } from '@/components/ui/toastStore';
import MapSheet from '../panels/MapSheet';
import {
  barrierDirections,
  collectMedia,
  CURRENCY_KEYS,
  formatClock,
  FUEL_FIELDS,
  fuelAvailable,
  isOpenNow,
  locationShareLink,
  parseWorkHours,
  text,
  type SelectedFeature,
} from './featureModel';
import { isFuelStation, isRoadBarrier, targetIcon, targetLabelKey } from '../targets';
import { copyText, isMobileBrowser, nativeShare } from '@/lib/clipboard';
import { formatNumber } from '@/lib/format';
import ContactButtons from './ContactButtons';
import { formatArea, formatLength } from '../tools/measure';
import RatingsBlock from './RatingsBlock';
import { useContactActions } from './useContactActions';

interface Props {
  feature: SelectedFeature;
  onClose: () => void;
  className?: string;
}

function StatusTile({ tone, icon, label, sub }: { tone: string; icon: string; label: string; sub?: string }) {
  return (
    <div
      className="rounded-lg border border-dashed p-3 text-center"
      style={{ borderColor: tone, background: `${tone}14` }}
    >
      <div className="text-sm font-bold" style={{ color: tone }}>
        <span aria-hidden>{icon}</span> {label}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-600">{sub}</div>}
    </div>
  );
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
  const { props, kind, id } = feature;

  const isBarrier = isRoadBarrier(kind);
  const typeTitle = kind.kind === 'location' ? t('popup.sharedLocation') : t(targetLabelKey(kind));
  const icon = kind.kind === 'location' ? '📍' : targetIcon(kind);
  const name = text(props.name);
  const providerName = name || (kind.kind === 'realEstate' ? t('popup.advertiser') : t('popup.provider'));
  const place = text(props.location_name) || text(props.location);
  const media = collectMedia(props).map<GalleryItem>((m) =>
    m.type === 'link' ? { type: 'link', url: m.url, label: t(m.labelKey) } : m,
  );

  const hours = parseWorkHours(props.work_hours);
  const hoursText = hours.allDay
    ? t('popup.allDay')
    : 'raw' in hours
      ? hours.raw
      : t('popup.availableFromTo', {
          from: formatClock(hours.from, i18n.language),
          to: formatClock(hours.to, i18n.language),
        });
  const open = isOpenNow(props.auto_status);

  const whatsapp = text(props.whatsapp);
  const phone = text(props.phone);
  const isLinkedProvider = kind.kind === 'service' && !!id && !!linked.data?.get(kind.discriminator)?.has(id);
  const dirs = isBarrier ? barrierDirections(props) : null;
  const price = Number(props.price);

  return (
    <MapSheet
      side="start"
      className={className}
      label={typeTitle}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm">{name || typeTitle}</div>
            {name && (
              <div className="truncate text-xs font-normal text-slate-500">
                {typeTitle}
                {id ? ` · #${id}` : ''}
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {kind.kind === 'location' && (
          <p className="text-sm text-slate-600">{t('popup.sharedLocationHint')}</p>
        )}

        {dirs && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-center text-[11px] text-slate-500">{t('popup.inbound')}</div>
              <StatusTile
                tone={dirs.inbound.color}
                icon={dirs.inbound.icon}
                label={t(`roadStatus.${dirs.inbound.key}`)}
              />
            </div>
            <div>
              <div className="mb-1 text-center text-[11px] text-slate-500">{t('popup.outbound')}</div>
              {dirs.outbound ? (
                <StatusTile
                  tone={dirs.outbound.color}
                  icon={dirs.outbound.icon}
                  label={t(`roadStatus.${dirs.outbound.key}`)}
                />
              ) : (
                <StatusTile tone="#6c757d" icon="⚪" label={t('popup.notSet')} />
              )}
            </div>
          </div>
        )}

        {kind.kind === 'service' && id && !isBarrier && (
          <RatingsBlock layer={kind.discriminator} featureId={id} />
        )}

        {kind.kind !== 'location' && !isBarrier && (
          <StatusTile
            tone={open ? '#28a745' : '#dc3545'}
            icon={open ? '🟢' : '🔴'}
            label={open ? t('popup.openNow') : t('popup.closedNow')}
            sub={hoursText}
          />
        )}

        {kind.kind !== 'location' && (
          <SectionCard title={t('popup.details')} icon={<Info className="h-4 w-4" aria-hidden />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('popup.name')} value={name} wide />
              <Field label={t('popup.place')} value={place} wide />
              {kind.kind === 'realEstate' && (
                <>
                  <Field
                    label={t('popup.price')}
                    value={
                      Number.isFinite(price) && price > 0
                        ? `${formatNumber(price, i18n.language)} ${CURRENCY_KEYS[text(props.currency)] ? t(CURRENCY_KEYS[text(props.currency)]) : ''}`.trim()
                        : null
                    }
                  />
                  <Field
                    label={t('popup.area')}
                    value={text(props.area) ? `${text(props.area)} ${t('map.areaUnit')}` : null}
                  />
                </>
              )}
              {feature.measure && (
                <Field
                  wide
                  label={feature.measure.kind === 'area' ? t('popup.mapArea') : t('popup.mapLength')}
                  value={
                    feature.measure.kind === 'area'
                      ? formatArea(feature.measure.squareMeters, t)
                      : formatLength(feature.measure.meters, t)
                  }
                />
              )}
              <Field label={t('popup.village')} value={text(props.village_a)} />
              <Field label={t('popup.governorate')} value={text(props.gov_a)} />
              <Field
                label={isBarrier ? t('popup.notes') : t('popup.description')}
                value={text(props.des)}
                wide
              />
            </div>
            {isFuelStation(kind) && (
              <ul className="space-y-1.5" aria-label={t('popup.fuel.title')}>
                {FUEL_FIELDS.map((f) => {
                  const ok = fuelAvailable(props, f);
                  return (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-sm font-bold"
                      style={{ color: ok ? '#28a745' : '#dc3545' }}
                    >
                      <span aria-hidden>{ok ? '✔️' : '❌'}</span>
                      {t(`popup.fuel.${f}`)}
                      <span className="sr-only">
                        {ok ? t('popup.fuel.available') : t('popup.fuel.unavailable')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        )}

        {media.length > 0 && <MediaGallery items={media} />}

        {kind.kind !== 'location' &&
          !isBarrier &&
          (isLinkedProvider ? (
            // Registered providers are contacted through a service request (chat) — ported with the requests feature.
            <Button
              className="w-full"
              startIcon={<Send className="h-4 w-4" />}
              disabled
              title={t('popup.requestSoon')}
            >
              {t('popup.requestService')}
            </Button>
          ) : (
            <ContactButtons
              layout="card"
              phone={phone}
              whatsapp={whatsapp}
              onCall={() => void contact.call(feature, providerName, phone)}
              onWhatsapp={() => void contact.whatsapp(feature, providerName, whatsapp, typeTitle)}
            />
          ))}

        <Button
          variant="secondary"
          className="w-full"
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
        <p className="flex items-center justify-center gap-1 text-[11px] text-slate-400" dir="ltr">
          <MapPin className="h-3 w-3" aria-hidden /> {feature.coordinate.map((n) => n.toFixed(1)).join(', ')}
        </p>
      </div>
    </MapSheet>
  );
}

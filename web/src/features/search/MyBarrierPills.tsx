import { useTranslation } from 'react-i18next';
import { useStatusRows } from '@/api/liveStatus';
import StatusDot from '@/components/ui/StatusDot';
import { barrierDirections, text } from '../map/popup/featureModel';
import { toResults } from '../map/search/results';
import { targetFromKey } from '../map/targets';
import { useMyBarriers } from '../map/extras/myBarriers';

const BARRIERS = targetFromKey('road_barriers');

function Pills({ starred, pill, onClick }: { starred: string[]; pill: string; onClick: () => void }) {
  const { t } = useTranslation();
  const rows = useStatusRows('road_barriers');
  const results = rows.data ? toResults(rows.data, BARRIERS) : [];
  const mine = starred.map((id) => results.find((r) => r.id === id)).filter((r) => !!r);
  return mine.map((r) => {
    const { inbound } = barrierDirections(r.props);
    const name = text(r.props.name) || t('myBarriers.checkpoint');
    return (
      <button key={r.key} type="button" onClick={onClick} className={pill} title={t('myBarriers.title')}>
        <StatusDot color={inbound.color} className="h-2.5 w-2.5" /> {name}
        <span className="text-xs font-medium text-muted">{t(`roadStatus.${inbound.key}`)}</span>
      </button>
    );
  });
}

/** «حواجزي» next to the road-status pill: each starred checkpoint with its state (inbound), opening the status list. */
export default function MyBarrierPills({ pill, onClick }: { pill: string; onClick: () => void }) {
  const starred = useMyBarriers((s) => s.ids);
  return starred.length > 0 ? <Pills starred={starred} pill={pill} onClick={onClick} /> : null;
}

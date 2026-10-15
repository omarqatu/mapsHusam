import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStatusRows } from '@/api/liveStatus';
import { toast } from '@/components/ui/toastStore';
import { showSystemNotification } from '@/lib/pwa';
import { barrierDirections, text } from '../popup/featureModel';
import { toResults } from '../search/results';
import { targetFromKey } from '../targets';
import { barrierState, changedBarriers, useMyBarriers } from './myBarriers';

const BARRIERS = targetFromKey('road_barriers');

/** Reads the checkpoint list (the same query as the status list, every minute) only while something is starred. */
function Watch({ starred }: { starred: string[] }) {
  const { t } = useTranslation();
  const rows = useStatusRows('road_barriers');
  const seen = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!rows.data) return;
    const results = toResults(rows.data, BARRIERS);
    const now = new Map(results.filter((r) => r.id).map((r) => [r.id!, barrierState(r.props)]));
    for (const id of changedBarriers(seen.current, now, starred)) {
      const r = results.find((x) => x.id === id)!;
      const { inbound, outbound } = barrierDirections(r.props);
      const name = text(r.props.name) || t('myBarriers.checkpoint');
      const body = [
        `${t('popup.inbound')}: ${t(`roadStatus.${inbound.key}`)}`,
        outbound && `${t('popup.outbound')}: ${t(`roadStatus.${outbound.key}`)}`,
      ]
        .filter(Boolean)
        .join(' · ');
      toast.info(t('myBarriers.changed', { name, status: body }));
      if (document.hidden)
        void showSystemNotification(t('myBarriers.changedTitle', { name }), body, '/search');
    }
    seen.current = now;
  }, [rows.data, starred, t]);
  return null;
}

/** «حواجزي»: a toast — and a system notification when the app is in the background — when a starred checkpoint changes. */
export default function MyBarriersWatcher() {
  const starred = useMyBarriers((s) => s.ids);
  return starred.length > 0 ? <Watch starred={starred} /> : null;
}

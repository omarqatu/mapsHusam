import { Fuel, TrafficCone } from 'lucide-react';
import { useStatusUpdatedAt, type StatusLayer } from '@/api/liveStatus';
import StatusTab from '@/features/map/extras/StatusTab';
import UpdatedAgo from '@/features/map/extras/UpdatedAgo';
import GroupCard from './GroupCard';

/** Road checkpoints / fuel stations: the map's live status list (search, refresh, tap = show on the map) inside a card. */
export default function StatusCard({
  id,
  title,
  layer,
  className,
}: {
  id: string;
  title: string;
  layer: StatusLayer;
  className?: string;
}) {
  const updated = useStatusUpdatedAt(layer);
  const road = layer === 'road_barriers';
  return (
    <GroupCard
      id={id}
      title={title}
      icon={road ? <TrafficCone className="h-5 w-5" aria-hidden /> : <Fuel className="h-5 w-5" aria-hidden />}
      chip={road ? 'bg-orange-100 text-orange-800' : 'bg-sky-100 text-sky-800'}
      subtitle={<UpdatedAgo at={updated.data} now={updated.dataUpdatedAt} />}
      className={className}
    >
      <StatusTab layer={layer} showUpdated={false} initialCount={10} />
    </GroupCard>
  );
}

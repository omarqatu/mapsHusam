import Greeting from './Greeting';
import HomeCards from './HomeCards';
import NeedsYou from './NeedsYou';
import PlatformFigures from './PlatformFigures';
import { useHomeData } from './useHomeData';
import { useSectionShown } from '@/features/visibility/store';

/**
 * Signed-in landing page (`/home`): a greeting and search, what is waiting for the user, and the entrances to the
 * rest of the platform for their role. On phones the order is the priority; from `lg` the "needs you" list becomes
 * a side column next to the cards.
 */
export default function HomePage() {
  const data = useHomeData();
  const statsOn = useSectionShown('stats');
  return (
    <div className="space-y-6">
      <Greeting />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <NeedsYou data={data} />
        <HomeCards data={data} />
      </div>
      {statsOn && <PlatformFigures platform={data.platform} />}
    </div>
  );
}

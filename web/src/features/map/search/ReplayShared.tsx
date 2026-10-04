import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui/toastStore';
import { decodeShareState } from './shareLink';
import { useSearchActions } from './useSearchActions';

/** Opening `/?resultsShare=…` re-runs that search once the map is ready (legacy polled 40 × 200 ms for the same effect). */
export default function ReplayShared() {
  const { t } = useTranslation();
  const actions = useSearchActions();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const raw = new URLSearchParams(window.location.search).get('resultsShare');
    if (!raw) return;
    const state = decodeShareState(raw);
    if (!state) return void toast.warning(t('search.results.badLink'));
    void actions.replay(state).then((ok) => ok || toast.warning(t('search.results.badLink')));
  }, [actions, t]);

  return null;
}

import { useTranslation } from 'react-i18next';
import { targetFromKey, targetLabelKey } from '../targets';
import type { EditTarget } from './schema';

/** Display name of an edit target: the map's own names for real estate and services, `edit.targets.*` for roads / regions. */
export function useTargetLabel() {
  const { t } = useTranslation();
  return (target: EditTarget) => {
    const known = targetFromKey(target.id);
    return known ? t(targetLabelKey(known)) : t(`edit.targets.${target.id}`);
  };
}

import { useMemo, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Home, RotateCcw, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import PageHeader from '@/components/ui/PageHeader';
import SearchInput from '@/components/ui/SearchInput';
import SectionCard from '@/components/ui/SectionCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toastStore';
import { groupedTargets } from '@/features/map/extras/featured';
import { matchesQuery } from '@/features/map/extras/status';
import { groupLabelKey } from '@/features/map/registry';
import { GROUP_ICON } from '@/features/map/registry/groupIcons';
import { targetKey, targetLabelKey } from '@/features/map/targets';
import {
  ALL_VISIBLE,
  SECTION_IDS,
  isLayerShown,
  isSectionShown,
  realEstateOnly,
  sameVisibility,
  withLayers,
  withSection,
  type Visibility,
} from '@/features/visibility/model';
import { useSaveVisibility, useVisibilityQuery } from '@/features/visibility/store';
import { errorText } from '@/lib/errorText';
import TargetIcon from '@/features/map/TargetIcon';

const GROUPS = groupedTargets();
const TOTAL = GROUPS.reduce((n, g) => n + g.targets.length, 0);

/**
 * `/admin/visibility` — what the public sees: whole sections of the site, and every layer (map type) by group. The
 * choice is a draft until "save"; then every page follows it (the admin still sees everything, marked as hidden).
 */
export default function AdminVisibilityPage() {
  const { t } = useTranslation();
  const stored = useVisibilityQuery();
  const save = useSaveVisibility();
  // The draft starts from the stored choice once it is known (adjust state while rendering — no effect needed).
  const [draft, setDraft] = useState<Visibility | null>(null);
  const [query, setQuery] = useState('');
  if (!draft && stored.data) setDraft(stored.data);

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        matching: g.targets.filter((x) => matchesQuery(t(targetLabelKey(x)), query)),
      })).filter((g) => g.matching.length > 0),
    [query, t],
  );

  if (stored.isPending) return <CenteredSpinner />;
  if (stored.isError || !draft)
    return <AlertMessage type="error" message={errorText(stored.error, t('visibility.loadFailed'))} />;

  const dirty = !sameVisibility(draft, stored.data ?? ALL_VISIBLE);
  const shownCount = TOTAL - draft.hiddenLayers.size;
  const onSave = () =>
    save.mutate(draft, {
      onSuccess: () => toast.success(t('visibility.saved')),
      onError: (e) => toast.error(errorText(e, t('visibility.saveFailed'))),
    });

  return (
    <>
      <PageHeader
        title={t('visibility.title')}
        description={t('visibility.subtitle')}
        icon={<Eye className="h-6 w-6" aria-hidden />}
        actions={
          <>
            <Button
              variant="secondary"
              startIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
              disabled={!dirty || save.isPending}
              onClick={() => setDraft(stored.data ?? ALL_VISIBLE)}
            >
              {t('visibility.discard')}
            </Button>
            <Button
              startIcon={<Save className="h-4 w-4" aria-hidden />}
              disabled={!dirty}
              loading={save.isPending}
              onClick={onSave}
            >
              {t('visibility.save')}
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        <AlertMessage type="info" message={t('visibility.adminNote')} />

        <SectionCard title={t('visibility.sectionsTitle')} subtitle={t('visibility.sectionsHint')}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {SECTION_IDS.map((id) => (
              <li key={id} className="rounded-lg border border-line p-3">
                <Checkbox
                  checked={isSectionShown(draft, id)}
                  onChange={(on) => setDraft(withSection(draft, id, on))}
                  label={<span className="font-bold">{t(`visibility.sections.${id}.name`)}</span>}
                />
                <p className="ms-7 mt-1 text-sm text-muted">{t(`visibility.sections.${id}.hint`)}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t('visibility.visitorContact.title')}>
          <div className="rounded-lg border border-line p-3">
            <Checkbox
              checked={draft.visitorContact}
              onChange={(on) => setDraft({ ...draft, visitorContact: on })}
              label={<span className="font-bold">{t('visibility.visitorContact.name')}</span>}
            />
            <p className="ms-7 mt-1 text-sm text-muted">{t('visibility.visitorContact.hint')}</p>
          </div>
        </SectionCard>

        <SectionCard
          title={t('visibility.layersTitle')}
          subtitle={t('visibility.layersHint')}
          badge={
            <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-bold text-muted" dir="ltr">
              {shownCount}/{TOTAL}
            </span>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              startIcon={<Home className="h-4 w-4" aria-hidden />}
              onClick={() => setDraft(realEstateOnly(draft))}
            >
              {t('visibility.realEstateOnly')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              startIcon={<Eye className="h-4 w-4" aria-hidden />}
              onClick={() => setDraft({ ...draft, hiddenLayers: new Set() })}
            >
              {t('visibility.showAll')}
            </Button>
            <div className="w-full sm:ms-auto sm:w-64">
              <SearchInput
                value={query}
                onChange={setQuery}
                debounceMs={0}
                placeholder={t('search.filterTypes')}
              />
            </div>
          </div>

          <div className="space-y-2">
            {groups.map((g) => {
              const Icon = GROUP_ICON[g.group];
              const keys = g.targets.map(targetKey);
              const on = keys.filter((k) => isLayerShown(draft, k)).length;
              return (
                <details
                  key={g.group}
                  open={query.trim() !== '' || undefined}
                  className="group rounded-xl border border-line"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                    <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    <span className="flex-1 text-sm font-bold text-fg">{t(groupLabelKey(g.group))}</span>
                    {on === 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                        <EyeOff className="h-3 w-3" aria-hidden />
                        {t('visibility.hiddenBadge')}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-muted" dir="ltr">
                      {on}/{keys.length}
                    </span>
                    <Checkbox
                      aria-label={t(groupLabelKey(g.group))}
                      checked={on === keys.length}
                      indeterminate={on > 0 && on < keys.length}
                      // the box switches the whole group; it must not also open / close the group
                      onClick={(e) => e.stopPropagation()}
                      onChange={(v) => setDraft(withLayers(draft, keys, v))}
                    />
                  </summary>
                  <ul className="grid gap-1 border-t border-line p-2 sm:grid-cols-2 lg:grid-cols-3">
                    {g.matching.map((x) => {
                      const key = targetKey(x);
                      return (
                        <li key={key}>
                          <Checkbox
                            className="w-full rounded-lg px-2 py-1.5 hover:bg-subtle"
                            checked={isLayerShown(draft, key)}
                            onChange={(v) => setDraft(withLayers(draft, [key], v))}
                            label={
                              <span className="flex items-center gap-2">
                                <span aria-hidden className="text-lg">
                                  <TargetIcon target={x} />
                                </span>
                                {t(targetLabelKey(x))}
                              </span>
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}
            {groups.length === 0 && <p className="text-sm text-muted">{t('common.noData')}</p>}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

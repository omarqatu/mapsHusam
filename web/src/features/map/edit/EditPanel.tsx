import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import Collection from 'ol/Collection';
import Feature from 'ol/Feature';
import type OlMap from 'ol/Map';
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import type Geometry from 'ol/geom/Geometry';
import type Point from 'ol/geom/Point';
import Draw from 'ol/interaction/Draw';
import type Interaction from 'ol/interaction/Interaction';
import Modify from 'ol/interaction/Modify';
import Select from 'ol/interaction/Select';
import Snap from 'ol/interaction/Snap';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Hexagon, MapPin, Pencil, Plus, Route, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SelectInput from '@/components/ui/SelectInput';
import Tabs, { type TabDef } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/toastStore';
import { SERVICE_TYPE_BY_KEY } from '../config';
import { useOlMap } from '../MapContext';
import MapSheet from '../panels/MapSheet';
import { useMapUi } from '../store';
import { setDoubleClickZoom } from '../tools/measure';
import AttributeDialog from './AttributeDialog';
import CredentialsDialog from './CredentialsDialog';
import { initialValues, type FormValues } from './attributes';
import { buildFeatureTx } from './buildTx';
import { createEditOnlyLayer, findLayer, overlayStyle, selectStyle, sourceOf } from './editLayers';
import { representativePoint, toGeometryData } from './geometry';
import { lookupRegional } from './regional';
import {
  POINT_TARGETS,
  POLYGON_TARGETS,
  LINE_TARGETS,
  editTargetById,
  serviceTarget,
  type EditKind,
  type EditTarget,
} from './schema';
import { TRANSPORT_NEEDS_CREDENTIALS, saveFeature } from './transport';
import type { FeatureTx, SaveResult } from './tx';
import { useTargetLabel } from './useTargetLabel';

type Mode = 'add' | 'modify' | 'delete';
type Step = 'idle' | 'draw' | 'pick' | 'form' | 'shape' | 'confirm' | 'credentials';

/** Everything about the one edit in progress. */
interface Session {
  step: Step;
  mode: Mode | null;
  /** What the feature belongs to (for services: the type of the feature that was tapped, not the one in the list). */
  target: EditTarget | null;
  feature: Feature | null;
  /** Geometry before the edit; put back when the edit is abandoned. */
  original: Geometry | null;
  /** What the attribute dialog last held. */
  values: FormValues | null;
  tx: FeatureTx | null;
  /** Where "cancel" of the login dialog returns to. */
  back: 'form' | 'shape' | 'confirm';
  shapeTool: 'points' | 'redraw';
  /** A save is being prepared (region look-up) — the buttons wait. */
  preparing: boolean;
}

const IDLE: Session = {
  step: 'idle',
  mode: null,
  target: null,
  feature: null,
  original: null,
  values: null,
  tx: null,
  back: 'form',
  shapeTool: 'points',
  preparing: false,
};

const DRAW_TYPE = { point: 'Point', line: 'LineString', polygon: 'Polygon' } as const;
const KIND_TARGETS = { point: POINT_TARGETS, line: LINE_TARGETS, polygon: POLYGON_TARGETS } as const;
const DEFAULT_TARGET: Record<EditKind, string> = { point: 'rent', line: 'roads', polygon: 'land' };
const HIT_TOLERANCE = 8;

/** The layers that belong to the editor itself: what is being edited, and the two that exist only for editing. */
function useEditorLayers(map: OlMap) {
  const { t } = useTranslation();
  const [layers] = useState(() => {
    const onError = () => toast.error(t('map.layerLoadFailed'));
    return {
      overlay: new VectorLayer({ source: new VectorSource(), style: overlayStyle, zIndex: 2500 }),
      roads: createEditOnlyLayer('roads', onError),
      locations: createEditOnlyLayer('locations', onError),
    };
  });
  useEffect(() => {
    const all = [layers.locations, layers.roads, layers.overlay];
    all.forEach((l) => map.addLayer(l));
    return () => all.forEach((l) => map.removeLayer(l));
  }, [map, layers]);
  return layers;
}

/** Current view resolution, so "zoom in" notices follow the map. */
function useResolution(map: OlMap) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const key = map.on('moveend', cb);
      return () => unByKey(key);
    },
    [map],
  );
  return useSyncExternalStore(subscribe, () => map.getView().getResolution() ?? 0);
}

export default function EditPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const map = useOlMap()!;
  const targetLabel = useTargetLabel();
  const layers = useEditorLayers(map);
  const overlay = layers.overlay.getSource()!;
  const resolution = useResolution(map);
  const realEstateVisible = useMapUi((s) => s.realEstateVisible);
  const hiddenServices = useMapUi((s) => s.hiddenServices);

  const [kind, setKind] = useState<EditKind>('point');
  const [targetIds, setTargetIds] = useState(DEFAULT_TARGET);
  const [s, setS] = useState<Session>(IDLE);
  const [sketching, setSketching] = useState(false);
  const draw = useRef<Draw | null>(null);
  const patch = useCallback((p: Partial<Session>) => setS((prev) => ({ ...prev, ...p })), []);

  const selected = editTargetById(kind, targetIds[kind])!;
  const layerFor = useCallback(
    (key: string): VectorLayer | null =>
      key === 'roads' ? layers.roads : key === 'locations' ? layers.locations : findLayer(map, key),
    [map, layers],
  );
  const selectedLayer = layerFor(selected.layerKey);

  // The edit-only layers are drawn only while their target is chosen.
  useEffect(() => {
    layers.roads.setVisible(selected.id === 'roads');
    layers.locations.setVisible(selected.id === 'locations');
  }, [layers, selected.id]);

  // --- leaving an edit ----------------------------------------------------------------------------------
  const cancel = useCallback(() => {
    setSketching(false);
    setS(IDLE);
  }, []);

  // An abandoned edit puts the geometry back. After a successful save the layer is reloaded, so this touches a feature
  // that is no longer in it.
  const { step, mode, target, feature, original, shapeTool } = s;
  useEffect(() => {
    if (!feature || !original) return;
    return () => feature.setGeometry(original);
  }, [feature, original]);

  useEffect(() => {
    if (step === 'idle') overlay.clear();
  }, [step, overlay]);

  // Escape ends the tool in progress (dialogs handle their own).
  useEffect(() => {
    if (step !== 'draw' && step !== 'pick' && step !== 'shape') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      cancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step, cancel]);

  // --- interactions ----------------------------------------------------------------------------------------
  const activeStep = step === 'draw' || step === 'pick' || step === 'shape';
  const layerSource = selectedLayer ? sourceOf(selectedLayer) : null;

  // While a tool is active a double click must not zoom (it also ends a line / polygon).
  useEffect(() => {
    if (!activeStep) return;
    setDoubleClickZoom(map, false);
    // A double click that ends a shape is still being handled: zoom comes back on the next tick.
    return () => void window.setTimeout(() => setDoubleClickZoom(map, true), 0);
  }, [map, activeStep]);

  // Add: Draw one new feature, then the dialog.
  useEffect(() => {
    if (step !== 'draw' || mode !== 'add' || !target || !layerSource) return;
    overlay.clear();
    const interaction = new Draw({ source: overlay, type: DRAW_TYPE[target.kind] });
    const keys: EventsKey[] = [
      interaction.on('drawstart', () => setSketching(target.kind !== 'point')),
      interaction.on('drawabort', () => setSketching(false)),
      interaction.on('drawend', (e) => {
        setSketching(false);
        patch({ step: 'form', feature: e.feature, original: null, values: null });
      }),
    ];
    const snap = new Snap({ source: layerSource });
    map.addInteraction(interaction);
    map.addInteraction(snap); // Snap goes last so it sees the edits of the others
    draw.current = interaction;
    const canvas = map.getTargetElement();
    canvas.style.cursor = 'crosshair';
    return () => {
      unByKey(keys);
      map.removeInteraction(interaction);
      map.removeInteraction(snap);
      draw.current = null;
      canvas.style.cursor = '';
    };
  }, [map, step, mode, target, layerSource, overlay, patch]);

  // Modify / Delete: Select one feature of the layer.
  useEffect(() => {
    if (step !== 'pick' || !mode || mode === 'add' || !target || !selectedLayer) return;
    const isService = target.workspace === 'services';
    const select = new Select({
      layers: [selectedLayer],
      hitTolerance: HIT_TOLERANCE,
      style: selectStyle,
      // Every service type shares one layer: any tapped service is editable, as its own type (legacy).
      filter: (f) => !isService || SERVICE_TYPE_BY_KEY.has(String(f.get('discriminator'))),
    });
    const key = select.on('select', (e) => {
      const tapped = e.selected[0] as Feature | undefined;
      const geometry = tapped?.getGeometry();
      if (!tapped || !geometry) return;
      select.getFeatures().clear();
      const picked = isService ? serviceTarget(String(tapped.get('discriminator'))) : target;
      overlay.clear();
      overlay.addFeature(new Feature(geometry)); // shares the geometry: the ring follows every edit
      patch({
        step: mode === 'delete' ? 'confirm' : 'form',
        target: picked,
        feature: tapped,
        original: geometry.clone(),
        values: null,
      });
    });
    const snap = new Snap({ source: sourceOf(selectedLayer) });
    map.addInteraction(select);
    map.addInteraction(snap);
    return () => {
      unByKey(key);
      map.removeInteraction(select);
      map.removeInteraction(snap);
    };
  }, [map, step, mode, target, selectedLayer, overlay, patch]);

  // Shape phase: Modify the feature (drag vertices / the point), or redraw a polygon's outline.
  useEffect(() => {
    if (step !== 'shape' || !target || !feature || !layerSource) return;
    const keys: EventsKey[] = [];
    const interactions: Interaction[] = [];
    const canvas = map.getTargetElement();
    if (shapeTool === 'redraw') {
      const redraw = new Draw({ type: 'Polygon' });
      keys.push(
        redraw.on('drawend', (e) => {
          const geometry = e.feature.getGeometry();
          if (geometry) {
            feature.setGeometry(geometry);
            overlay.getFeatures().forEach((f) => f !== feature && f.setGeometry(geometry));
          }
          patch({ shapeTool: 'points' });
        }),
      );
      interactions.push(redraw);
      canvas.style.cursor = 'crosshair';
    } else {
      interactions.push(new Modify({ features: new Collection([feature]), pixelTolerance: 14 }));
      if (target.kind === 'point')
        // Legacy: the next tap on the map is the new position.
        keys.push(
          map.on('singleclick', (e) => {
            (feature.getGeometry() as Point | null)?.setCoordinates(e.coordinate);
          }),
        );
    }
    interactions.push(new Snap({ source: layerSource }));
    interactions.forEach((i) => map.addInteraction(i));
    return () => {
      unByKey(keys);
      interactions.forEach((i) => map.removeInteraction(i));
      canvas.style.cursor = '';
    };
  }, [map, step, target, feature, shapeTool, layerSource, overlay, patch]);

  // --- saving -------------------------------------------------------------------------------------------------
  /** Builds the transaction of the current edit; `null` (with a message) when it cannot be built. */
  const buildTx = async (op: FeatureTx['op'], values: FormValues | null): Promise<FeatureTx | null> => {
    if (!target || !feature) return null;
    const shape = feature.getGeometry();
    const geometry = shape ? toGeometryData(shape, target.geometry) : null;
    if (op !== 'delete' && !geometry) {
      toast.error(t('edit.errors.badShape'));
      return null;
    }
    const needsRegion =
      op === 'insert'
        ? target.kind !== 'polygon' || target.id === 'land'
        : op === 'update' && target.id === 'roads';
    const regional =
      needsRegion && geometry ? await lookupRegional(representativePoint(geometry)) : undefined;
    const built = buildFeatureTx({
      op,
      target,
      featureId: (feature.getId() ?? feature.get('fid') ?? feature.get('id')) as string | number | undefined,
      geometry: geometry ?? undefined,
      values: values ?? undefined,
      regional,
    });
    if (!built.ok) {
      toast.error(t(`edit.errors.${built.error}`));
      return null;
    }
    return built.tx;
  };

  const finishSave = (tx: FeatureTx) => {
    // Reload the layer first: it discards the (possibly moved) feature object and brings in the saved row.
    const layer = layerFor(s.target?.layerKey ?? selected.layerKey);
    if (layer) sourceOf(layer).refresh();
    toast.success(t(`edit.saved.${tx.op}`));
    cancel();
  };

  const runSave = async (
    tx: FeatureTx,
    login?: { username: string; password: string },
  ): Promise<SaveResult> => {
    const result = await saveFeature(login ? { ...tx, credentials: login } : tx);
    if (result.ok) finishSave(tx);
    return result;
  };

  /** Goes on to the login dialog (or straight to saving once the transport needs none). */
  const proceed = async (tx: FeatureTx, back: Session['back']) => {
    if (TRANSPORT_NEEDS_CREDENTIALS) patch({ step: 'credentials', tx, back, preparing: false });
    else {
      patch({ preparing: false });
      const result = await runSave(tx);
      if (!result.ok) toast.error(t(`edit.credentials.failed.${result.reason}`));
    }
  };

  const saveWith = async (values: FormValues, back: 'form' | 'shape') => {
    patch({ values, preparing: true });
    const tx = await buildTx(s.mode === 'add' ? 'insert' : 'update', values);
    if (!tx) return patch({ preparing: false });
    await proceed(tx, back);
  };

  const confirmDelete = async () => {
    patch({ preparing: true });
    const tx = await buildTx('delete', null);
    if (!tx) return patch({ preparing: false });
    await proceed(tx, 'confirm');
  };

  // --- ui -----------------------------------------------------------------------------------------------------------
  const start = (mode: Mode) => {
    if (s.mode === mode) return cancel();
    setSketching(false);
    setS({ ...IDLE, step: mode === 'add' ? 'draw' : 'pick', mode, target: selected });
  };
  const changeKind = (next: EditKind) => {
    cancel();
    setKind(next);
  };

  const tabs: TabDef<EditKind>[] = [
    { id: 'point', label: t('edit.tabs.point'), icon: <MapPin className="h-4 w-4" aria-hidden /> },
    { id: 'line', label: t('edit.tabs.line'), icon: <Route className="h-4 w-4" aria-hidden /> },
    { id: 'polygon', label: t('edit.tabs.polygon'), icon: <Hexagon className="h-4 w-4" aria-hidden /> },
  ];

  const options = useMemo(
    () =>
      KIND_TARGETS[kind].map((target) => ({
        value: target.id,
        label: targetLabel(target),
        group:
          kind !== 'point'
            ? undefined
            : target.workspace === 'services'
              ? t('edit.groups.services')
              : t('edit.groups.realEstate'),
      })),
    // targetLabel changes identity every render; the language is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, t],
  );

  // Notices: an edit needs the layer on screen to pick from it.
  const hidden =
    selected.layerKey in realEstateVisible
      ? !realEstateVisible[selected.layerKey as keyof typeof realEstateVisible]
      : selected.discriminator
        ? hiddenServices.has(selected.discriminator)
        : false;
  const maxResolution = selectedLayer?.getMaxResolution() ?? Infinity;
  const tooFar = resolution > maxResolution;
  const showLayer = () => {
    const ui = useMapUi.getState();
    if (selected.layerKey in realEstateVisible)
      ui.setRealEstateVisible(selected.layerKey as keyof typeof realEstateVisible, true);
    else if (selected.discriminator) ui.setServiceVisible(selected.discriminator, true);
  };

  const hintKey =
    s.step === 'draw'
      ? `edit.hint.draw.${kind}`
      : s.step === 'pick'
        ? `edit.hint.pick.${s.mode}`
        : s.step === 'shape'
          ? s.shapeTool === 'redraw'
            ? 'edit.hint.redraw'
            : `edit.hint.shape.${kind}`
          : 'edit.hint.idle';

  const featureName = s.feature ? String(s.feature.get('name') ?? '').trim() : '';
  const dialogTarget = s.target ?? selected;
  const geometry = s.feature?.getGeometry();
  const position =
    dialogTarget.kind === 'point' && geometry && 'getCoordinates' in geometry
      ? ((geometry as Point).getCoordinates() as [number, number])
      : undefined;

  return (
    <>
      <MapSheet
        side="end"
        label={t('edit.title')}
        title={t('edit.title')}
        dragId="edit"
        onClose={() => {
          cancel();
          onClose();
        }}
      >
        {/* Phones: while a tool is active only the hint and its buttons stay, so the map is visible. */}
        <div className={clsx(activeStep && 'max-sm:hidden')}>
          <Tabs tabs={tabs} value={kind} onChange={changeKind} label={t('edit.tabsLabel')} idPrefix="edit" />
          <div className="mt-4">
            <label htmlFor="edit-layer" className="mb-1.5 block text-sm font-semibold text-slate-700">
              {t('edit.layer')}
            </label>
            {KIND_TARGETS[kind].length > 1 ? (
              <SelectInput
                id="edit-layer"
                searchable={kind === 'point'}
                options={options}
                value={targetIds[kind]}
                onChange={(e) => {
                  cancel();
                  setTargetIds((ids) => ({ ...ids, [kind]: e.target.value }));
                }}
              />
            ) : (
              <p
                id="edit-layer"
                className="rounded-lg bg-slate-50 px-3 py-2.5 text-base font-semibold text-slate-800"
              >
                {targetLabel(selected)}
              </p>
            )}
          </div>

          {(hidden || tooFar) && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {hidden ? t('edit.layerHidden') : t('edit.zoomIn')}
              {hidden && (
                <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={showLayer}>
                  {t('edit.showLayer')}
                </Button>
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button
              size="sm"
              variant={s.mode === 'add' ? 'primary' : 'secondary'}
              aria-pressed={s.mode === 'add'}
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => start('add')}
            >
              {t('edit.actions.add')}
            </Button>
            <Button
              size="sm"
              variant={s.mode === 'modify' ? 'primary' : 'secondary'}
              aria-pressed={s.mode === 'modify'}
              startIcon={<Pencil className="h-4 w-4" />}
              onClick={() => start('modify')}
            >
              {t('edit.actions.modify')}
            </Button>
            <Button
              size="sm"
              variant={s.mode === 'delete' ? 'danger' : 'secondary'}
              aria-pressed={s.mode === 'delete'}
              className={s.mode === 'delete' ? undefined : 'text-red-700'}
              startIcon={<Trash2 className="h-4 w-4" />}
              onClick={() => start('delete')}
            >
              {t('edit.actions.delete')}
            </Button>
          </div>
        </div>

        <p role="status" className={clsx('text-sm text-slate-700', activeStep ? 'mt-0' : 'mt-4')}>
          {t(hintKey)}
        </p>

        {s.step === 'draw' && sketching && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={() => draw.current?.removeLastPoint()}>
              {t('edit.undoPoint')}
            </Button>
            <Button size="sm" onClick={() => draw.current?.finishDrawing()}>
              {t('edit.finishShape')}
            </Button>
          </div>
        )}

        {s.step === 'shape' && (
          <div className="mt-3 space-y-2">
            {dialogTarget.kind === 'polygon' && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={s.shapeTool === 'points' ? 'primary' : 'secondary'}
                  aria-pressed={s.shapeTool === 'points'}
                  onClick={() => patch({ shapeTool: 'points' })}
                >
                  {t('edit.shape.points')}
                </Button>
                <Button
                  size="sm"
                  variant={s.shapeTool === 'redraw' ? 'primary' : 'secondary'}
                  aria-pressed={s.shapeTool === 'redraw'}
                  onClick={() => patch({ shapeTool: 'redraw' })}
                >
                  {t('edit.shape.redraw')}
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={cancel} disabled={s.preparing}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" loading={s.preparing} onClick={() => void saveWith(s.values ?? {}, 'shape')}>
                {t('edit.dialog.save')}
              </Button>
            </div>
          </div>
        )}

        {s.step === 'pick' && (
          <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={cancel}>
            {t('common.cancel')}
          </Button>
        )}
        {s.step === 'draw' && (
          <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={cancel}>
            {t('common.cancel')}
          </Button>
        )}
      </MapSheet>

      {s.step === 'form' && s.feature && (
        <AttributeDialog
          key={`${s.feature.getId() ?? 'new'}`}
          target={dialogTarget}
          mode={s.mode === 'add' ? 'insert' : 'update'}
          initial={s.values ?? initialValues(dialogTarget, s.feature.getProperties())}
          position={position}
          busy={s.preparing}
          onSave={(values) => void saveWith(values, 'form')}
          onEditShape={(values) => patch({ step: 'shape', values, shapeTool: 'points' })}
          onCancel={cancel}
        />
      )}

      <ConfirmDialog
        open={s.step === 'confirm'}
        tone="danger"
        title={t('edit.delete.title')}
        message={
          featureName ? t('edit.delete.messageNamed', { name: featureName }) : t('edit.delete.message')
        }
        confirmLabel={t('edit.delete.confirm')}
        loading={s.preparing}
        onConfirm={() => void confirmDelete()}
        onCancel={cancel}
      />

      {s.step === 'credentials' && s.tx && (
        <CredentialsDialog
          confirmLabel={t(`edit.credentials.confirm.${s.tx.op}`)}
          onSubmit={(login) => runSave(s.tx!, login)}
          onCancel={() => patch({ step: s.back, tx: null })}
        />
      )}
    </>
  );
}

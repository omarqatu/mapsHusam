import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Bell, Check, Palette, PanelTop, RotateCcw, Save, Search, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toastStore';
import { HEADER_TONES } from '@/components/headerStyles';
import { errorText } from '@/lib/errorText';
import { formatDateTime } from '@/lib/format';
import {
  DEFAULT_THEME,
  HEADER_STYLES,
  PRESETS,
  contrast,
  deriveTokens,
  normalizeHex,
  sameTheme,
  type BrandTheme,
  type HeaderStyle,
} from './model';
import { useBrandTheme, useSaveTheme, useThemeQuery } from './store';

/** A colour picker with its hex value, editable by hand. */
function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // What the admin is typing; null = show the colour itself.
  const [typed, setTyped] = useState<string | null>(null);
  return (
    <label className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-fg">{label}</span>
        <input
          dir="ltr"
          value={typed ?? value}
          onBlur={() => setTyped(null)}
          onChange={(e) => {
            setTyped(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }}
          className="mt-0.5 w-full bg-transparent font-mono text-sm uppercase text-muted outline-none"
          aria-label={label}
        />
      </span>
    </label>
  );
}

/** A small, real rendering of the top bar in one style (same classes as the header). */
function MiniBar({ style }: { style: HeaderStyle }) {
  const tone = HEADER_TONES[style];
  return (
    <div className={clsx('flex h-10 items-center gap-1.5 rounded-t-lg px-2', tone.bar)}>
      <span className={clsx('h-6 w-6 shrink-0 rounded-lg', tone.mark)} />
      <span className="h-2 w-10 rounded-full bg-current opacity-60" />
      <span className={clsx('mx-auto flex gap-1 rounded-lg p-0.5', tone.group)}>
        <span className={clsx('h-5 w-8 rounded-md', tone.tabOn)} />
        <span className="h-5 w-8 rounded-md" />
      </span>
      <span className={clsx('h-6 w-6 shrink-0 rounded-full', tone.avatar)} />
    </div>
  );
}

function Swatch({ label, color, note }: { label: string; color: string; note?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-9 w-9 shrink-0 rounded-lg shadow-card ring-1 ring-line" style={{ backgroundColor: color }} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg">{label}</span>
        <span dir="ltr" className="block font-mono text-xs uppercase text-muted">
          {color}
          {note && <span className="ms-1.5 normal-case">{note}</span>}
        </span>
      </span>
    </div>
  );
}

/**
 * Admin: the platform's brand colours and the style of the top bar (water platform: Admin → Appearance, reduced to
 * what this app themes). Every change shows at once on the whole app (live preview); "save" publishes it to every
 * visitor, leaving the page without saving drops it.
 */
export default function AdminAppearancePage() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = useThemeQuery();
  const saved = useBrandTheme((s) => s.saved);
  const draft = useBrandTheme((s) => s.draft);
  const setDraft = useBrandTheme((s) => s.setDraft);
  const save = useSaveTheme();
  const [confirmReset, setConfirmReset] = useState(false);

  // Leaving the page drops an unsaved preview.
  useEffect(() => () => setDraft(null), [setDraft]);

  if (isLoading) return <CenteredSpinner />;
  const theme = draft ?? saved;
  const dirty = !sameTheme(theme, saved);
  const change = (patch: Partial<BrandTheme>) => setDraft({ ...theme, ...patch });
  const tokens = deriveTokens(theme);
  const adjusted = tokens.light['--color-brand'] !== theme.primary;
  const done = (message: string) => ({
    onSuccess: () => toast.success(message),
    onError: (e: unknown) => toast.error(errorText(e, t('appearance.failed'))),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Palette className="h-6 w-6" aria-hidden />}
        title={t('appearance.title')}
        description={t('appearance.description')}
        actions={
          <>
            {dirty && (
              <Button variant="ghost" startIcon={<Undo2 className="h-4 w-4" aria-hidden />} onClick={() => setDraft(null)}>
                {t('appearance.discard')}
              </Button>
            )}
            <Button
              startIcon={<Save className="h-4 w-4" aria-hidden />}
              disabled={!dirty}
              loading={save.isPending}
              onClick={() => save.mutate(theme, done(t('appearance.saved')))}
            >
              {t('appearance.save')}
            </Button>
          </>
        }
      />

      {isError && <AlertMessage type="error" message={t('appearance.loadFailed')} />}
      <div
        className={clsx(
          'flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold',
          dirty ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok',
        )}
        role="status"
      >
        {dirty ? <Palette className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
        {dirty ? t('appearance.previewing') : t('appearance.live')}
        {!dirty && data?.updatedAt && (
          <span className="ms-auto text-xs font-medium opacity-80">
            {t('appearance.updatedAt', { date: formatDateTime(data.updatedAt, i18n.language) })}
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <SectionCard title={t('appearance.palette')} icon={<Palette className="h-5 w-5" aria-hidden />}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((p) => {
                const on = p.primary === theme.primary && p.secondary === theme.secondary;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => change({ primary: p.primary, secondary: p.secondary })}
                    className={clsx(
                      'flex items-center gap-2.5 rounded-xl border p-2.5 text-start text-sm font-bold transition',
                      on ? 'border-brand bg-brand-light text-brand-fg ring-1 ring-brand' : 'border-line hover:bg-subtle',
                    )}
                  >
                    <span
                      className="relative h-8 w-8 shrink-0 rounded-full shadow-card"
                      style={{ backgroundImage: `linear-gradient(135deg, ${p.primary} 50%, ${p.secondary} 50%)` }}
                    >
                      {on && <Check className="absolute inset-0 m-auto h-4 w-4 text-white" aria-hidden />}
                    </span>
                    {t(`appearance.presets.${p.id}`)}
                  </button>
                );
              })}
            </div>
            <p className="pt-1 text-sm font-bold text-fg">{t('appearance.custom')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ColorInput label={t('appearance.primary')} value={theme.primary} onChange={(primary) => change({ primary })} />
              <ColorInput
                label={t('appearance.secondary')}
                value={theme.secondary}
                onChange={(secondary) => change({ secondary })}
              />
            </div>
          </SectionCard>

          <SectionCard title={t('appearance.header')} icon={<PanelTop className="h-5 w-5" aria-hidden />}>
            <div className="grid gap-3 sm:grid-cols-3">
              {HEADER_STYLES.map((s) => {
                const on = theme.header === s;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => change({ header: s })}
                    className={clsx(
                      'overflow-hidden rounded-xl border text-start transition',
                      on ? 'border-brand ring-2 ring-brand' : 'border-line hover:border-line-strong',
                    )}
                  >
                    <MiniBar style={s} />
                    <span className="block bg-canvas px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-fg">
                        {on && <Check className="h-4 w-4 text-brand-fg" aria-hidden />}
                        {t(`appearance.headerStyles.${s}.name`)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{t(`appearance.headerStyles.${s}.hint`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <SectionCard title={t('appearance.preview')}>
            <div className="overflow-hidden rounded-xl border border-line bg-canvas">
              <MiniBar style={theme.header} />
              <div className="space-y-3 p-3">
                <div className="flex h-10 items-center gap-2 rounded-xl bg-surface px-3 text-sm text-muted ring-1 ring-line-strong">
                  <Search className="h-4 w-4" aria-hidden />
                  <span className="flex-1 truncate">{t('appearance.sample.search')}</span>
                  <span className="rounded-lg bg-brand px-3 py-1 text-xs font-bold text-white">{t('common.search')}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-brand-light px-2.5 py-1 text-xs font-bold text-brand-fg">
                    {t('appearance.sample.chip')}
                  </span>
                  <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-fg">
                    {t('appearance.sample.chip2')}
                  </span>
                </div>
                <div className="rounded-xl bg-surface p-3 shadow-card">
                  <p className="text-sm font-bold text-fg">{t('appearance.sample.card')}</p>
                  <p className="mt-0.5 text-xs text-muted">{t('appearance.sample.cardText')}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-brand-fg">
                    <Bell className="h-4 w-4" aria-hidden />
                    {t('appearance.sample.link')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span className="rounded-lg bg-brand py-2 text-center text-sm font-bold text-white">
                    {t('appearance.sample.primary')}
                  </span>
                  <span className="rounded-lg bg-gradient-to-l from-brand to-brand-2 py-2 text-center text-sm font-bold text-white">
                    {t('appearance.sample.gradient')}
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('appearance.derived')}>
            <div className="grid gap-3">
              <Swatch
                label={t('appearance.tokens.brand')}
                color={tokens.light['--color-brand']}
                note={`${contrast(tokens.light['--color-brand'], '#ffffff').toFixed(1)}:1`}
              />
              <Swatch label={t('appearance.tokens.hover')} color={tokens.light['--color-brand-hover']} />
              <Swatch label={t('appearance.tokens.text')} color={tokens.light['--color-brand-fg']} />
              <Swatch label={t('appearance.tokens.light')} color={tokens.light['--color-brand-light']} />
              <Swatch label={t('appearance.tokens.textDark')} color={tokens.dark['--color-brand-fg']} />
            </div>
            {adjusted && <p className="text-xs text-muted">{t('appearance.adjusted')}</p>}
          </SectionCard>

          <Button
            variant="secondary"
            className="w-full"
            startIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
            disabled={sameTheme(saved, DEFAULT_THEME) && !dirty}
            onClick={() => setConfirmReset(true)}
          >
            {t('appearance.reset')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={t('appearance.reset')}
        message={t('appearance.resetConfirm')}
        loading={save.isPending}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() =>
          save.mutate(null, {
            ...done(t('appearance.resetDone')),
            onSettled: () => setConfirmReset(false),
          })
        }
      />
    </div>
  );
}

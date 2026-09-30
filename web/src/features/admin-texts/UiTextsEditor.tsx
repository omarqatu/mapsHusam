import { useState } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import SectionCard from '@/components/ui/SectionCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import TextareaInput from '@/components/ui/TextareaInput';
import { toast } from '@/components/ui/toastStore';
import {
  MAX_TEXT_LENGTH,
  NO_OVERRIDES,
  TEXT_GROUPS,
  defaultText,
  isValidOverride,
  sameOverrides,
  type Lang,
  type TextOverrides,
} from '@/features/text-overrides/model';
import { useSaveTextOverrides, useTextOverridesQuery } from '@/features/text-overrides/store';
import { errorText } from '@/lib/errorText';

const LANGS: Lang[] = ['ar', 'en'];
const nameKey = (key: string) => `texts.ui.names.${key.replaceAll('.', '_')}`;

/** One line of interface text in both languages; an empty box = the built-in text (shown as the placeholder). */
function TextRow({
  textKey,
  draft,
  onChange,
}: {
  textKey: string;
  draft: TextOverrides;
  onChange: (lang: Lang, value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="rounded-xl border border-line p-3">
      <p className="mb-2 text-sm font-bold text-fg">{t(nameKey(textKey))}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {LANGS.map((lang) => {
          const value = draft[lang][textKey] ?? '';
          const bad = value.trim() !== '' && !isValidOverride(lang, textKey, value) && value.trim() !== defaultText(lang, textKey);
          const id = `ui-text-${textKey}-${lang}`;
          return (
            <FormField
              key={lang}
              name={id}
              label={t(`texts.ui.lang.${lang}`)}
              error={bad ? t('texts.ui.invalid', { max: MAX_TEXT_LENGTH }) : undefined}
            >
              <TextareaInput
                id={id}
                rows={2}
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                lang={lang}
                hasError={bad}
                maxLength={MAX_TEXT_LENGTH}
                placeholder={defaultText(lang, textKey)}
                value={value}
                onChange={(e) => onChange(lang, e.target.value)}
              />
            </FormField>
          );
        })}
      </div>
    </li>
  );
}

/**
 * The interface texts (search page, welcome page) reworded in both languages: the built-in wording is the placeholder,
 * a filled box replaces it for every visitor. Plain text only; `{{count}}` in a line that has it must stay.
 */
export default function UiTextsEditor() {
  const { t } = useTranslation();
  const stored = useTextOverridesQuery();
  const save = useSaveTextOverrides();
  const [draft, setDraft] = useState<TextOverrides | null>(null);
  if (!draft && stored.data) setDraft(stored.data);

  if (stored.isPending) return <CenteredSpinner />;
  if (stored.isError || !draft)
    return <AlertMessage type="error" message={errorText(stored.error, t('texts.loadFailed'))} />;

  const current = stored.data ?? NO_OVERRIDES;
  // What would be stored: only lines that differ from the built-in text and are valid; the rest fall back to it.
  const clean: TextOverrides = { ar: {}, en: {} };
  let invalid = 0;
  for (const lang of LANGS)
    for (const [key, value] of Object.entries(draft[lang])) {
      if (isValidOverride(lang, key, value)) clean[lang][key] = value.trim();
      else if (value.trim() !== '' && value.trim() !== defaultText(lang, key)) invalid += 1;
    }
  const dirty = !sameOverrides(clean, current);

  const set = (key: string) => (lang: Lang, value: string) =>
    setDraft({ ...draft, [lang]: { ...draft[lang], [key]: value } });
  const onSave = () =>
    save.mutate(clean, {
      onSuccess: () => {
        setDraft(clean);
        toast.success(t('texts.saved'));
      },
      onError: (e) => toast.error(errorText(e, t('texts.failed'))),
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t('texts.ui.hint')}</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            startIcon={<Undo2 className="h-4 w-4" aria-hidden />}
            disabled={!dirty && invalid === 0}
            onClick={() => setDraft(current)}
          >
            {t('texts.discard')}
          </Button>
          <Button
            size="sm"
            startIcon={<Save className="h-4 w-4" aria-hidden />}
            disabled={!dirty || invalid > 0}
            loading={save.isPending}
            onClick={onSave}
          >
            {t('texts.save')}
          </Button>
        </div>
      </div>
      {TEXT_GROUPS.map((g) => (
        <SectionCard key={g.id} title={t(`texts.ui.groups.${g.id}`)}>
          <ul className="space-y-3">
            {g.keys.map((k) => (
              <TextRow key={k} textKey={k} draft={draft} onChange={set(k)} />
            ))}
          </ul>
        </SectionCard>
      ))}
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { KEYWORD_MIN_CHARS } from './queries';

const DEBOUNCE_MS = 400; // legacy value

interface Props {
  /** The committed term (URL `?q=`). */
  value: string;
  onCommit: (term: string) => void;
}

/**
 * The search box at the top (legacy "market search"): results follow the typing after 400 ms; Enter or the button
 * searches at once. Fewer than two letters shows a hint instead of an alert.
 */
export default function KeywordSearch({ value, onCommit }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  const [hint, setHint] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Follow the URL (back button, "clear") without an effect: adjust state while rendering.
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }

  useEffect(() => {
    const clean = text.trim();
    if (clean === value) return;
    if (clean.length > 0 && clean.length < KEYWORD_MIN_CHARS) return; // wait for the second letter
    const id = setTimeout(() => onCommit(clean), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text, value, onCommit]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (clean.length < KEYWORD_MIN_CHARS) {
      setHint(true);
      return;
    }
    setHint(false);
    onCommit(clean);
  };

  return (
    <form onSubmit={submit} role="search" className="space-y-1.5">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <TextInput
            ref={input}
            type="search"
            inputSize="lg"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setHint(false);
            }}
            placeholder={t('search.globalPlaceholder')}
            aria-label={t('search.globalPlaceholder')}
            startIcon={<Search className="h-5 w-5" aria-hidden />}
            className="[&::-webkit-search-cancel-button]:hidden"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        {text && (
          <Button
            variant="secondary"
            size="lg"
            aria-label={t('searchPage.clearKeyword')}
            title={t('searchPage.clearKeyword')}
            onClick={() => {
              setText('');
              setHint(false);
              onCommit('');
              input.current?.focus();
            }}
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
        )}
        <Button type="submit" size="lg" startIcon={<Search className="h-5 w-5" aria-hidden />}>
          <span className="hidden sm:inline">{t('common.search')}</span>
        </Button>
      </div>
      {hint && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {t('searchPage.minChars', { count: KEYWORD_MIN_CHARS })}
        </p>
      )}
    </form>
  );
}

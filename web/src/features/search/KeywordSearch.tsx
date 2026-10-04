import { useEffect, useRef, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { KEYWORD_MIN_CHARS } from './queries';

const DEBOUNCE_MS = 400; // legacy value

interface Props {
  /** The committed term (URL `?q=`). */
  value: string;
  onCommit: (term: string) => void;
  /** The hero's bigger box. */
  large?: boolean;
}

/**
 * The search box of the page (legacy "market search"), one joined control: field, clear, search.
 * Results follow the typing after 400 ms; Enter or the button searches at once. Fewer than two letters shows a hint.
 */
export default function KeywordSearch({ value, onCommit, large }: Props) {
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
      <div className={clsx('flex items-stretch rounded-2xl bg-surface p-1 ring-1 ring-line-strong transition-shadow focus-within:ring-2 focus-within:ring-brand', large ? 'h-14 shadow-float' : 'h-12 shadow-sm')}>
        <span className="pointer-events-none flex items-center ps-2.5 text-muted">
          <Search className="h-5 w-5" aria-hidden />
        </span>
        <input
          ref={input}
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setHint(false);
          }}
          placeholder={t('search.globalPlaceholder')}
          aria-label={t('search.globalPlaceholder')}
          className="min-w-0 flex-1 bg-transparent px-2.5 text-base text-fg outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          autoComplete="off"
          enterKeyHint="search"
        />
        {text && (
          <button
            type="button"
            aria-label={t('searchPage.clearKeyword')}
            title={t('searchPage.clearKeyword')}
            onClick={() => {
              setText('');
              setHint(false);
              onCommit('');
              input.current?.focus();
            }}
            className="flex w-9 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-fg"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl bg-brand px-5 text-base font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Search className="h-5 w-5 sm:hidden" aria-hidden />
          <span className="max-sm:sr-only">{t('common.search')}</span>
        </button>
      </div>
      {hint && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {t('searchPage.minChars', { count: KEYWORD_MIN_CHARS })}
        </p>
      )}
    </form>
  );
}

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOutsideClick } from '@/hooks/useOutsideClick';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Options with the same group are shown under one heading (in the order groups first appear). */
  group?: string;
}

export interface SelectInputProps {
  options: SelectOption[];
  value?: string;
  /** Same shape as the water platform's SelectInput (event-like), so call sites read the same. */
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  /** Shown when nothing is selected. Picking it again is not possible — clear by choosing another option. */
  placeholder?: string;
  hasError?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  /** Adds a filter box at the top of the list (long lists: service types, place names). */
  searchable?: boolean;
  'aria-label'?: string;
}

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-3.5 text-base',
  lg: 'h-[3.25rem] px-4 text-base',
} as const;

/**
 * Styled listbox replacing the native <select>, whose open list and hover use the OS blue and can't be themed.
 * API mirrors the water platform's SelectInput (pwa-1 components/ui); adds keyboard navigation, type-ahead, ARIA
 * listbox roles, groups and an optional filter box.
 */
export default function SelectInput({
  options,
  value = '',
  onChange,
  placeholder,
  hasError,
  inputSize = 'md',
  disabled,
  id,
  name,
  className,
  searchable,
  'aria-label': ariaLabel,
}: SelectInputProps) {
  const { t } = useTranslation();
  const uid = useId();
  const listId = `${uid}-list`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(-1);
  const typeahead = useRef({ text: '', at: 0 });

  const selected = options.find((o) => o.value === value);
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, filter]);

  const openList = () => {
    if (disabled) return;
    setFilter('');
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };
  const close = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  };
  const choose = (o: SelectOption | undefined) => {
    if (!o || o.disabled) return;
    onChange?.({ target: { value: o.value, name } });
    close();
  };

  const closeQuietly = useCallback(() => setOpen(false), []);
  useOutsideClick(root, closeQuietly, open);
  useEffect(() => {
    if (open && searchable) filterRef.current?.focus();
  }, [open, searchable]);

  // Keep the active option in view while moving with the keyboard.
  useEffect(() => {
    if (open && active >= 0)
      document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, uid]);

  const move = (from: number, step: 1 | -1) => {
    for (let i = from + step; i >= 0 && i < visible.length; i += step) if (!visible[i].disabled) return i;
    return from;
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => move(a, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => move(a, -1));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? move(-1, 1) : move(visible.length, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(visible[active]);
    } else if (!searchable && e.key.length === 1) {
      // Type-ahead: jump to the first option starting with what was typed quickly.
      const now = Date.now();
      const ta = typeahead.current;
      ta.text = now - ta.at < 700 ? ta.text + e.key.toLowerCase() : e.key.toLowerCase();
      ta.at = now;
      const i = visible.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(ta.text));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <div ref={root} className={clsx('relative', className)}>
      <button
        ref={trigger}
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 && !searchable ? `${uid}-opt-${active}` : undefined}
        aria-invalid={hasError || undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKey}
        className={clsx(
          'flex w-full items-center justify-between gap-2 rounded-lg border bg-surface text-start transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand',
          'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted',
          hasError
            ? 'border-danger-solid'
            : open
              ? 'border-brand ring-2 ring-brand/20'
              : 'border-line-strong hover:border-line-strong',
          sizes[inputSize],
        )}
      >
        <span className={clsx('flex-1 truncate', !selected && 'text-muted')}>
          {selected?.label ?? placeholder ?? ' '}
        </span>
        <ChevronDown
          className={clsx(
            'h-4 w-4 shrink-0 text-muted transition-transform',
            open && 'rotate-180 text-brand-fg',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="absolute inset-x-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          {searchable && (
            <div className="border-b border-line p-2">
              <div className="flex items-center gap-2 rounded-lg bg-subtle px-2.5">
                <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <input
                  ref={filterRef}
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKey}
                  placeholder={t('common.search')}
                  aria-label={t('common.search')}
                  aria-controls={listId}
                  aria-activedescendant={active >= 0 ? `${uid}-opt-${active}` : undefined}
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </div>
          )}
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 && (
              <li className="px-3.5 py-2.5 text-sm text-muted">{t('common.noData')}</li>
            )}
            {visible.map((o, i) => {
              const heading = o.group && o.group !== visible[i - 1]?.group ? o.group : null;
              const isSelected = o.value === value;
              return (
                <li key={o.value} role="presentation">
                  {heading && (
                    <div
                      role="presentation"
                      className="px-3.5 pt-2 pb-1 text-xs font-bold tracking-wide text-muted"
                    >
                      {heading}
                    </div>
                  )}
                  {/* ARIA combobox pattern: focus stays on the combobox (aria-activedescendant) and its onKeyDown does
                      arrows / Enter / Escape, so an option is neither focusable nor a key target. */}
                  {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus -- see above */}
                  <div
                    id={`${uid}-opt-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={o.disabled || undefined}
                    onPointerMove={() => active !== i && setActive(i)}
                    onClick={() => choose(o)}
                    className={clsx(
                      'flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-sm',
                      isSelected
                        ? 'bg-brand-light font-semibold text-brand-fg'
                        : i === active
                          ? 'bg-subtle text-fg'
                          : 'text-fg',
                      o.disabled && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

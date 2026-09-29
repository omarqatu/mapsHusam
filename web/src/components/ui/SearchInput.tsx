import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import TextInput from './TextInput';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Delay before `onChange` fires while typing (ms). */
  debounceMs?: number;
  className?: string;
}

/** Controlled from outside, but typing is debounced so a query hook isn't hit per keystroke. */
export default function SearchInput({
  value,
  onChange,
  placeholder,
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const [local, setLocal] = useState(value);
  // Follow external resets (e.g. "clear filters") without an effect: adjust state during render.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setLocal(value);
  }
  useEffect(() => {
    if (local === value) return;
    const id = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(id);
  }, [local, value, onChange, debounceMs]);

  return (
    <div className={className}>
      <TextInput
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        startIcon={<Search className="h-4 w-4" />}
        aria-label={placeholder}
      />
    </div>
  );
}

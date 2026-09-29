import { useState, type FormEvent } from 'react';
import { CalendarDays, MapPinned, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import { formatLongDate } from '@/lib/format';
import { KEYWORD_MIN_CHARS } from '@/features/search/queries';
import { useAuthStore } from '@/store/authStore';
import { dayPart, firstName } from './model';

const ROLE_TONE = { admin: 'red', provider: 'blue', user: 'green' } as const;

/** Top of the page: who is signed in, today's date, and a search box that continues on the search page. */
export default function Greeting() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [now] = useState(() => new Date());
  const [text, setText] = useState('');
  const [short, setShort] = useState(false);
  if (!user) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (q.length < KEYWORD_MIN_CHARS) return setShort(true);
    void navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card md:p-8">
      {/* Decoration only: a soft brand disc in the corner, with a map mark on wide screens. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -end-12 -top-16 flex h-40 w-40 items-end justify-start rounded-full bg-brand-light p-0 md:h-72 md:w-72 md:p-16"
      >
        <MapPinned className="hidden h-16 w-16 text-brand-fg/50 md:block" />
      </span>

      <div className="relative">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" aria-hidden />
            {formatLongDate(now, i18n.language)}
          </span>
          <Badge tone={ROLE_TONE[user.role]}>{t(`roles.${user.role}`)}</Badge>
        </p>
        <h1 className="mt-2 break-words text-2xl font-black text-fg md:text-4xl">
          {t('home.hello', {
            greeting: t(`home.greeting.${dayPart(now.getHours())}`),
            name: firstName(user.full_name, user.phone),
          })}
        </h1>
        <p className="mt-1.5 max-w-2xl text-base text-muted">{t(`home.subtitle.${user.role}`)}</p>

        <form onSubmit={submit} role="search" className="mt-5 max-w-3xl" aria-label={t('home.search.label')}>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <TextInput
                type="search"
                inputSize="lg"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setShort(false);
                }}
                hasError={short}
                placeholder={t('home.search.placeholder')}
                aria-label={t('home.search.label')}
                startIcon={<Search className="h-5 w-5" aria-hidden />}
                className="[&::-webkit-search-cancel-button]:hidden"
                autoComplete="off"
                enterKeyHint="search"
              />
            </div>
            <Button type="submit" size="lg" startIcon={<Search className="h-5 w-5" aria-hidden />}>
              <span className="hidden sm:inline">{t('common.search')}</span>
            </Button>
          </div>
          {short && (
            <p role="alert" className="mt-1.5 text-sm font-semibold text-danger">
              {t('searchPage.minChars', { count: KEYWORD_MIN_CHARS })}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

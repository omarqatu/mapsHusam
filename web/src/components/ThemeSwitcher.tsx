import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { currentTheme, setTheme } from '@/lib/theme';

/** Light / dark toggle for the top bar (white icon on the brand gradient). */
export default function ThemeSwitcher() {
  const { t } = useTranslation();
  const [theme, setLocal] = useState(currentTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        setLocal(next);
      }}
      aria-label={t(next === 'dark' ? 'common.themeDark' : 'common.themeLight')}
      title={t(next === 'dark' ? 'common.themeDark' : 'common.themeLight')}
      className="rounded-lg p-2 text-white hover:bg-white/15"
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}

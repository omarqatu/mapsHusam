import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // XSS: user content goes through JSX only (CLAUDE.md invariant).
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'No dangerouslySetInnerHTML — render through JSX.',
        },
        {
          selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: 'No innerHTML/outerHTML — render through JSX.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Use api/client.ts (CLAUDE.md: all HTTP goes through it).' },
      ],
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // The only places allowed to call fetch: the API client, the GeoServer reader (no app token to GeoServer),
    // the third-party reader of the widgets (Open-Meteo / Aladhan — no app token to other origins), the map editor's write transport (the single WFS-T function; it sends the typed GeoServer login, never the app
    // token), and tests that stub it.
    files: [
      'src/api/client.ts',
      'src/api/geoserver.ts',
      'src/api/external.ts',
      'src/features/map/edit/transport.ts',
      '**/*.test.{ts,tsx}',
    ],
    rules: { 'no-restricted-globals': 'off' },
  },
]);

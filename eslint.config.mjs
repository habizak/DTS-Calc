import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Layering, same convention as CMD-Note:
 *   lib/pure/*  side-effect free, any layer may import it
 *   lib/infra/* storage, network, crypto: UI must not import it directly
 * The directory is the boundary. Unlike CMD-Note there is no lib/services.ts
 * composition root yet; add one when the first infra module lands.
 */
/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['.next/**', 'dist/**', 'public/sw.generated.js', 'coverage/**', 'playwright-report/**', 'test-results/**', '.monoform/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-shadow-restricted-names': ['error', { reportGlobalThis: false }],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'store/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/infra/*'],
              message: 'UI layer (app, components, store) must not import lib/infra/* directly. Use hooks or lib/pure/*.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'store/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]

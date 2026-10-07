import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// API среды выполнения, запрещённые в ядре engine и хосте протокола (research R2)
const SANS_IO_GLOBALS = [
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'queueMicrotask',
  'requestAnimationFrame',
  'console',
  'structuredClone',
  'fetch',
  'crypto',
  'performance',
  'process',
  'Deno',
  'Bun',
  'globalThis',
  'self',
  'window',
  'document',
  'TextEncoder',
  'TextDecoder',
].map((name) => ({ name, message: 'Ядро без ввода-вывода: API среды передаётся адаптером.' }));

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      '**/dist/',
      'ignore/',
      'build/',
      'coverage/',
      'test-results/',
      'playwright-report/',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Движок — чистый TypeScript: никакого UI, стора, хранилища и сторонних UI-библиотек.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'zustand', 'immer', 'idb-keyval', 'valibot'],
          patterns: ['@xyflow/*', '@dagflow/*', '**/src/**'],
        },
      ],
    },
  },
  {
    // Ядро без ввода-вывода (sans-IO, конституция 2.1.0, research R2): ни API среды, ни недетерминизма.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...SANS_IO_GLOBALS],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Время передаётся извне (sans-IO).' },
        { object: 'Math', property: 'random', message: 'Случайность передаётся извне (sans-IO).' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Время передаётся извне (sans-IO).',
        },
      ],
    },
  },
);

import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['node_modules/', 'dist/', 'build/', 'coverage/', 'test-results/', 'playwright-report/'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
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
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'zustand', 'immer', 'idb-keyval'],
          patterns: ['@xyflow/*', '**/ui/**', '**/store/**', '**/storage/**', '**/model/**'],
        },
      ],
    },
  },
);

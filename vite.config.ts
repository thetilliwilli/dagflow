import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Сборка публикуется на GitHub Pages по адресу /dagflow/; dev-сервер и e2e — в корне.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/dagflow/' : '/',
  plugins: [react()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['tests/component/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/component/setup.ts'],
        },
      },
    ],
  },
}));

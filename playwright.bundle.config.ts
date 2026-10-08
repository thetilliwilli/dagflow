// Проверка собранного редактора (research R13): Local и Worker на production-сборке, Chromium и Firefox
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: /engine-conformance\.spec\.ts/,
  fullyParallel: true,
  use: { baseURL: 'http://localhost:4173/dagflow/', trace: 'retain-on-failure' },
  projects: [
    { name: 'bundle-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'bundle-firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

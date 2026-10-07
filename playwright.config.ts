import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Тесты фичи 004 запускают собранный сервер выполнения
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /perf\.spec\.ts/ },
    // Замеры производительности — отдельно от основного прогона (npm run test:perf)
    { name: 'perf', use: { ...devices['Desktop Chrome'] }, testMatch: /perf\.spec\.ts/ },
    // Firefox: без выбора рабочей папки (такого API нет) — проверяем всё остальное (npm run test:e2e:firefox)
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /(perf|autosave-durability|opfs-fallback)\.spec\.ts/,
      grepInvert: /рабочая папка|требует подтверждения/,
    },
  ],
  webServer: { command: 'npm run dev', port: 5173, reuseExistingServer: true },
});

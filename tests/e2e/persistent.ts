// Фикстура с постоянным профилем браузера.
// Chromium падает при чтении из IndexedDB сохранённого FileSystemDirectoryHandle в изолированных
// («инкогнито») контекстах, которые Playwright создаёт по умолчанию. В настоящем браузере профиль
// всегда постоянный, поэтому сценарии с рабочей папкой запускаются так же (research R9).
import { chromium, test as base, type BrowserContext } from '@playwright/test';

export const test = base.extend<{ context: BrowserContext }>({
  context: async ({ baseURL, viewport }, use, info) => {
    const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
      headless: true,
      baseURL,
      viewport,
      acceptDownloads: true,
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()));
  },
});

export { expect } from '@playwright/test';

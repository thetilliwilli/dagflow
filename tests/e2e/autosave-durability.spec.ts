// SC-008: изменения, сделанные больше чем за 1 с до закрытия, сохраняются — в папке и в браузере
import type { Page } from '@playwright/test';
import { addNode, openSidebar } from './helpers';
import { expect, test } from './persistent';

async function changeWaitReload(page: Page) {
  const n = await addNode(page, 'Число', 60, 60);
  await n.getByLabel('value').fill('4242');
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.locator('.react-flow__node').getByLabel('value')).toHaveValue('4242');
}

test('SC-008: режим рабочей папки', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).showDirectoryPicker = async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('picked-folder', { create: true });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Выбрать рабочую папку' }).first().click();
  await page.getByRole('button', { name: 'Перенести' }).click();
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText('Папка: picked-folder');
  await changeWaitReload(page);
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText('Папка: picked-folder');
});

test('SC-008: режим хранилища браузера', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
  });
  await page.goto('/');
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText('Данные хранятся в браузере');
  await changeWaitReload(page);
});

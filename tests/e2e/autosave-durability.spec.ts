// SC-008: изменения, сделанные больше чем за 1 с до закрытия, сохраняются — в папке и в браузере
import type { Page } from '@playwright/test';
import { addNode, openSidebar, setInput, inputField } from './helpers';
import { expect, test } from './persistent';

async function changeWaitReload(page: Page) {
  const n = await addNode(page, 'Number', 60, 60);
  await setInput(page, n, 'value', '4242');
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(
    await inputField(page, page.locator('.react-flow__node').first(), 'value'),
  ).toHaveValue('4242');
}

test('SC-008: режим рабочей папки', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).showDirectoryPicker = async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('picked-folder', {
        create: true,
      });
  });
  await page.goto('/');
  await (
    await openSidebar(page)
  )
    .getByRole('button', { name: 'Choose working folder' })
    .first()
    .click();
  await (await openSidebar(page)).getByRole('button', { name: 'Move', exact: true }).click();
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText(
    'Folder: picked-folder',
  );
  await changeWaitReload(page);
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText(
    'Folder: picked-folder',
  );
});

test('SC-008: режим хранилища браузера', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
  });
  await page.goto('/');
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText(
    'Data is stored in the browser',
  );
  await changeWaitReload(page);
});

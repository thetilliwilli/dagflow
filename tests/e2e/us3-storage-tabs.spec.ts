import type { Page } from '@playwright/test';
import { expect, test } from './persistent';
import { readFileSync } from 'node:fs';
import { addNode, connect, openSidebar, tabBar, setInput, valueOf } from './helpers';

/** Диалог выбора папки → подпапка OPFS «picked-folder» (системный диалог в тестах недоступен). */
async function stubFolderPicker(page: Page, opts: { permission?: 'prompt' } = {}) {
  await page.addInitScript((permission) => {
    const w = window as unknown as Record<string, unknown>;
    w.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle('picked-folder', { create: true });
    };
    if (permission === 'prompt') {
      // До нажатия «Восстановить доступ» браузер «требует подтверждения»
      const proto = FileSystemHandle.prototype as unknown as Record<string, unknown>;
      let granted = false;
      proto.queryPermission = async () => (granted ? 'granted' : 'prompt');
      proto.requestPermission = async () => {
        granted = true;
        return 'granted';
      };
    }
  }, opts.permission);
}

async function listFolder(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('picked-folder');
    const out: string[] = [];
    for await (const [name, h] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
      if (h.kind === 'directory') {
        for await (const [n2] of (h as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) out.push(`${name}/${n2}`);
      } else out.push(name);
    }
    return out.sort();
  });
}

async function buildSum(page: Page, a: string, b: string) {
  const n1 = await addNode(page, 'Number', 30, 40);
  const sum = await addNode(page, 'Add', 260, 40);
  const show = await addNode(page, 'Show', 500, 40);
  await setInput(page, n1, 'value', a);
  await setInput(page, sum, 'b', b);
  await connect(page, n1, 'value', sum, 'a');
  await connect(page, sum, 'result', show, 'value');
  return show;
}

test('US3: рабочая папка, два workflow во вкладках, перезагрузка (#1, #3)', async ({ page }) => {
  await stubFolderPicker(page);
  await page.goto('/');
  await (await openSidebar(page)).getByRole('button', { name: 'Choose working folder' }).first().click();
  await (await openSidebar(page)).getByRole('button', { name: 'Move', exact: true }).click();
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText('Folder: picked-folder');

  const show1 = await buildSum(page, '2', '3');
  await expect(await valueOf(page, show1, 'in', 'value')).toHaveText('5');
  await (await openSidebar(page)).getByRole('button', { name: 'Create workflow' }).click();
  const show2 = await buildSum(page, '10', '20');
  await expect(await valueOf(page, show2, 'in', 'value')).toHaveText('30');

  await expect.poll(() => listFolder(page)).toHaveLength(3);
  await page.waitForTimeout(500); // автосохранение (300 мс)
  await page.reload();

  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText('Folder: picked-folder');
  await expect(tabBar(page).getByRole('tab')).toHaveCount(2);
  await expect(await valueOf(page, page.locator('.react-flow__node').filter({ hasText: 'Show' }), 'in', 'value')).toHaveText('30');
  await tabBar(page).getByRole('tab', { name: /^New workflow$/ }).click();
  await expect(await valueOf(page, page.locator('.react-flow__node').filter({ hasText: 'Show' }), 'in', 'value')).toHaveText('5');
  expect(await listFolder(page)).toEqual(
    expect.arrayContaining(['workspace.json', expect.stringMatching(/^workflows\/.+\.workflow\.json$/)]),
  );
});

test('US3: выгрузка → загрузка даёт идентичный граф; некорректный файл — ошибка (#6, #7)', async ({ page }, info) => {
  await page.goto('/');
  const show = await buildSum(page, '4', '5');
  await expect(await valueOf(page, show, 'in', 'value')).toHaveText('9');

  const downloadPromise = page.waitForEvent('download');
  await (await openSidebar(page)).getByRole('button', { name: 'Export to file' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('New workflow.dagflow.json');
  const path = info.outputPath('export.dagflow.json');
  await download.saveAs(path);

  await (await openSidebar(page)).getByLabel('Import from file').setInputFiles(path);
  await expect(tabBar(page).getByRole('tab')).toHaveCount(2);
  await expect(tabBar(page).getByRole('tab', { selected: true })).toHaveText('New workflow');
  await expect(await valueOf(page, page.locator('.react-flow__node').filter({ hasText: 'Show' }), 'in', 'value')).toHaveText('9');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  const exported = JSON.parse(readFileSync(path, 'utf8'));
  expect(exported).toMatchObject({ format: 'dagflow-export', version: 1 });

  await (await openSidebar(page)).getByLabel('Import from file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('просто текст') });
  await expect(page.getByRole('dialog', { name: 'Could not load the file' })).toContainText('The file is not valid JSON.');
  await page.getByRole('dialog', { name: 'Could not load the file' }).getByRole('button', { name: 'Close', exact: true }).click();
  await expect((await openSidebar(page)).getByTestId('workflow-list').getByRole('listitem')).toHaveCount(2);
});

test('US3: без поддержки папок — индикатор «Данные хранятся в браузере», автосохранение работает (#2)', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
  });
  await page.goto('/');
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText('Data is stored in the browser');
  await expect((await openSidebar(page)).getByRole('button', { name: 'Choose working folder' })).toHaveCount(0);
  const show = await buildSum(page, '1', '1');
  await expect(await valueOf(page, show, 'in', 'value')).toHaveText('2');
  await page.waitForTimeout(500);
  await page.reload();
  await expect(await valueOf(page, page.locator('.react-flow__node').filter({ hasText: 'Show' }), 'in', 'value')).toHaveText('2');
});

test('US3: браузер требует подтверждения — экран восстановления доступа, затем данные загружены (#3)', async ({ page }) => {
  await stubFolderPicker(page, { permission: 'prompt' });
  await page.goto('/');
  // Первый визит: выбор папки (requestPermission → granted) и создание данных
  await (await openSidebar(page)).getByRole('button', { name: 'Choose working folder' }).first().click();
  await (await openSidebar(page)).getByRole('button', { name: 'Move', exact: true }).click();
  const show = await buildSum(page, '7', '8');
  await expect(await valueOf(page, show, 'in', 'value')).toHaveText('15');
  await page.waitForTimeout(500);

  await page.reload(); // granted сбрасывается — нужен повторный доступ
  await expect(page.getByRole('heading', { name: 'Restore access to the working folder' })).toBeVisible();
  await expect(page.getByText('The browser keeps a separate set of data; the folder data stays untouched.')).toBeVisible();
  await page.getByRole('button', { name: 'Restore access' }).click();
  await expect(await valueOf(page, page.locator('.react-flow__node').filter({ hasText: 'Show' }), 'in', 'value')).toHaveText('15');
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText('Folder: picked-folder');
});

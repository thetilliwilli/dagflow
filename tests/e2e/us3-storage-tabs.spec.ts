import type { Page } from '@playwright/test';
import { expect, test } from './persistent';
import { readFileSync } from 'node:fs';
import { addNode, connect, openSidebar, tabBar, setInput } from './helpers';

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
  const n1 = await addNode(page, 'Число', 30, 40);
  const sum = await addNode(page, 'Сложить', 260, 40);
  const show = await addNode(page, 'Показать', 500, 40);
  await setInput(page, n1, 'value', a);
  await setInput(page, sum, 'b', b);
  await connect(page, n1, 'value', sum, 'a');
  await connect(page, sum, 'result', show, 'value');
  return show;
}

test('US3: рабочая папка, два workflow во вкладках, перезагрузка (#1, #3)', async ({ page }) => {
  await stubFolderPicker(page);
  await page.goto('/');
  await (await openSidebar(page)).getByRole('button', { name: 'Выбрать рабочую папку' }).first().click();
  await (await openSidebar(page)).getByRole('button', { name: 'Перенести' }).click();
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText('Папка: picked-folder');

  const show1 = await buildSum(page, '2', '3');
  await expect(show1.getByTestId('show-value')).toHaveText('5');
  await (await openSidebar(page)).getByRole('button', { name: 'Создать workflow' }).click();
  const show2 = await buildSum(page, '10', '20');
  await expect(show2.getByTestId('show-value')).toHaveText('30');

  await expect.poll(() => listFolder(page)).toHaveLength(3);
  await page.waitForTimeout(500); // автосохранение (300 мс)
  await page.reload();

  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText('Папка: picked-folder');
  await expect(tabBar(page).getByRole('tab')).toHaveCount(2);
  await expect(page.locator('[data-testid="show-value"]')).toHaveText('30');
  await tabBar(page).getByRole('tab', { name: /^Новый workflow$/ }).click();
  await expect(page.locator('[data-testid="show-value"]')).toHaveText('5');
  expect(await listFolder(page)).toEqual(
    expect.arrayContaining(['workspace.json', expect.stringMatching(/^workflows\/.+\.workflow\.json$/)]),
  );
});

test('US3: выгрузка → загрузка даёт идентичный граф; некорректный файл — ошибка (#6, #7)', async ({ page }, info) => {
  await page.goto('/');
  const show = await buildSum(page, '4', '5');
  await expect(show.getByTestId('show-value')).toHaveText('9');

  const downloadPromise = page.waitForEvent('download');
  await (await openSidebar(page)).getByRole('button', { name: 'Выгрузить в файл' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Новый workflow.dagflow.json');
  const path = info.outputPath('export.dagflow.json');
  await download.saveAs(path);

  await (await openSidebar(page)).getByLabel('Загрузить из файла').setInputFiles(path);
  await expect(tabBar(page).getByRole('tab')).toHaveCount(2);
  await expect(tabBar(page).getByRole('tab', { selected: true })).toHaveText('Новый workflow');
  await expect(page.locator('[data-testid="show-value"]')).toHaveText('9');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  const exported = JSON.parse(readFileSync(path, 'utf8'));
  expect(exported).toMatchObject({ format: 'dagflow-export', version: 1 });

  await (await openSidebar(page)).getByLabel('Загрузить из файла').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('просто текст') });
  await expect(page.getByRole('dialog', { name: 'Не удалось загрузить файл' })).toContainText('Файл не является корректным JSON');
  await page.getByRole('dialog', { name: 'Не удалось загрузить файл' }).getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect((await openSidebar(page)).getByTestId('workflow-list').getByRole('listitem')).toHaveCount(2);
});

test('US3: без поддержки папок — индикатор «Данные хранятся в браузере», автосохранение работает (#2)', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
  });
  await page.goto('/');
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText('Данные хранятся в браузере');
  await expect((await openSidebar(page)).getByRole('button', { name: 'Выбрать рабочую папку' })).toHaveCount(0);
  const show = await buildSum(page, '1', '1');
  await expect(show.getByTestId('show-value')).toHaveText('2');
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator('[data-testid="show-value"]')).toHaveText('2');
});

test('US3: браузер требует подтверждения — экран восстановления доступа, затем данные загружены (#3)', async ({ page }) => {
  await stubFolderPicker(page, { permission: 'prompt' });
  await page.goto('/');
  // Первый визит: выбор папки (requestPermission → granted) и создание данных
  await (await openSidebar(page)).getByRole('button', { name: 'Выбрать рабочую папку' }).first().click();
  await (await openSidebar(page)).getByRole('button', { name: 'Перенести' }).click();
  const show = await buildSum(page, '7', '8');
  await expect(show.getByTestId('show-value')).toHaveText('15');
  await page.waitForTimeout(500);

  await page.reload(); // granted сбрасывается — нужен повторный доступ
  await expect(page.getByRole('heading', { name: 'Восстановите доступ к рабочей папке' })).toBeVisible();
  await expect(page.getByText('В браузере хранится отдельный набор данных; данные папки останутся нетронутыми')).toBeVisible();
  await page.getByRole('button', { name: 'Восстановить доступ' }).click();
  await expect(page.locator('[data-testid="show-value"]')).toHaveText('15');
  await expect((await openSidebar(page)).getByTestId('storage-indicator')).toContainText('Папка: picked-folder');
});

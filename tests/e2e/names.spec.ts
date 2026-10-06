// Фича 003, US2: имена без ограничений длины, на любом языке (FR-007 – FR-009, SC-004)
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  addNode,
  closeSidebar,
  connect,
  openSidebar,
  paletteItem,
  selectNode,
  tabBar,
} from './helpers';

const card = (node: Locator) => node.locator('.flow-node');

async function rename(page: Page, node: Locator, name: string) {
  await node.locator('.flow-node__name').dblclick();
  const input = node.getByRole('textbox', { name: 'Имя нода' });
  await input.fill(name);
  await input.press('Enter');
}

async function renameWorkflow(page: Page, from: string, to: string) {
  const sidebar = await openSidebar(page);
  await sidebar.getByRole('button', { name: `Переименовать «${from}»` }).click();
  const input = sidebar.getByRole('textbox', { name: 'Имя workflow' });
  await input.fill(to);
  await input.press('Enter');
}

const phrase = (n: number, words = 'длинное имя ') =>
  words.repeat(Math.ceil(n / words.length)).slice(0, n - 1) + '.';

test('US2 #1, #5: имя нода из 300 символов — принято, карточка не шире предела, полное имя в подсказке и окне свойств', async ({
  page,
}) => {
  await page.goto('/');
  const short = await addNode(page, 'Число', 60, 60);
  const long = await addNode(page, 'Число', 60, 300);
  await rename(page, long, 'x'.repeat(40)); // предел ширины карточки (FR-007a 002)
  const limit = (await card(long).boundingBox())!.width;
  const name = phrase(300);
  await rename(page, long, name);
  await expect(long.locator('.flow-node__name')).toHaveAttribute('title', name);
  expect((await card(long).boundingBox())!.width).toBeLessThanOrEqual(limit + 1);
  expect((await card(long).boundingBox())!.height).toBeCloseTo(
    (await card(short).boundingBox())!.height,
    0,
  );
  await selectNode(long);
  await expect(
    page.getByRole('dialog', { name: 'Свойства' }).getByTestId('prop-grid-name'),
  ).toHaveText(name);
});

test('US2 #1, #2: workflow — 200 символов, составной нод — 150, порт нода «Вход» — 80; полные имена в подсказках', async ({
  page,
}) => {
  await page.goto('/');
  const wfName = phrase(200, 'workflow с длинным именем ');
  await renameWorkflow(page, 'Новый workflow', wfName);
  const sidebar = await openSidebar(page);
  await expect(sidebar.getByRole('button', { name: `Открыть «${wfName}»` })).toHaveAttribute(
    'title',
    wfName,
  );
  await expect(tabBar(page).getByRole('tab', { selected: true })).toHaveAttribute('title', wfName);
  await closeSidebar(page);

  const compName = phrase(150, 'составной нод ');
  // Внешняя связь — при сворачивании появится нод «Вход» с портом
  const num = await addNode(page, 'Число', 20, 120);
  const add = await addNode(page, 'Сложить', 300, 120);
  await connect(page, num, 'value', add, 'a');
  await selectNode(add);
  await page.getByRole('button', { name: 'Свернуть в составной нод' }).click();
  const dialog = page.getByRole('dialog', { name: 'Свернуть в составной нод' });
  await dialog.getByLabel('Имя составного нода').fill(compName);
  await dialog.getByRole('button', { name: 'Свернуть' }).click();
  await expect(await paletteItem(page, compName)).toHaveAttribute('title', compName);

  await page
    .getByRole('button', { name: `Открыть составной нод «${compName}»` })
    .first()
    .click();
  await expect(tabBar(page).getByRole('tab', { selected: true })).toHaveAttribute(
    'title',
    `Составной нод: ${compName}`,
  );
  const input = page
    .locator('.react-flow__node')
    .filter({ has: page.locator('.flow-node__type', { hasText: 'Вход' }) })
    .first();
  await selectNode(input);
  const portName = page
    .getByRole('dialog', { name: 'Свойства' })
    .getByRole('textbox', { name: 'Имя порта' })
    .first();
  const longPort = phrase(80, 'порт ');
  await portName.fill(longPort);
  await portName.press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(portName).toHaveValue(longPort);
});

test('US2 #4: пустое имя workflow и одни пробелы отклоняются', async ({ page }) => {
  await page.goto('/');
  for (const empty of ['', '   ']) {
    await renameWorkflow(page, 'Новый workflow', empty);
    await expect(page.getByRole('alert').last()).toContainText('The name cannot be empty.');
    await expect(tabBar(page).getByRole('tab', { selected: true })).toHaveText('Новый workflow');
  }
});

test('US2 #3, SC-004: имена на разных языках переживают выгрузку, загрузку и перезагрузку', async ({
  page,
}, info) => {
  await page.goto('/');
  const names = ['Итого', '合計', 'مجموع', 'Résumé 📈'];
  for (const [i, name] of names.entries()) {
    const node = await addNode(page, 'Число', 60, 40 + i * 150);
    await rename(page, node, name);
  }
  const wfName = '計算 · Расчёт · حساب 🧮';
  await renameWorkflow(page, 'Новый workflow', wfName);

  const download = page.waitForEvent('download');
  await (await openSidebar(page)).getByRole('button', { name: 'Выгрузить в файл' }).click();
  const path = info.outputPath('names.dagflow.json');
  await (await download).saveAs(path);
  const file = JSON.parse(readFileSync(path, 'utf8'));
  expect(file.workflow.name).toBe(wfName);
  expect(file.workflow.graph.nodes.map((n: { name: string }) => n.name)).toEqual(names);

  const sidebar = await openSidebar(page);
  await sidebar.getByRole('button', { name: `Удалить «${wfName}»` }).click();
  await page
    .getByRole('dialog', { name: 'Удалить workflow?' })
    .getByRole('button', { name: 'Удалить' })
    .click();
  await (await openSidebar(page)).getByLabel('Загрузить из файла').setInputFiles(path);
  await expect(tabBar(page).getByRole('tab', { selected: true })).toHaveText(wfName);

  await page.waitForTimeout(1000); // автосохранение — через 300 мс
  await page.reload();
  await expect(tabBar(page).getByRole('tab', { name: wfName })).toBeVisible();
  await tabBar(page).getByRole('tab', { name: wfName }).click();
  await expect(page.locator('.react-flow__node .flow-node__name')).toHaveText(names);
});

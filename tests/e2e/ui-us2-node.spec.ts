// US2 (фича 002): вид нода — тип и имя, переименование, размеры, синяя рамка выделения
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { addNode, openSidebar, selectNode, tabBar } from './helpers';

const card = (node: Locator) => node.locator('.flow-node');
const style = (l: Locator, prop: string) =>
  l.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

async function rename(page: Page, node: Locator, name: string) {
  await node.locator('.flow-node__name').dblclick();
  const input = node.getByRole('textbox', { name: 'Имя нода' });
  await input.fill(name);
  await input.press('Enter');
}

test('US2 #1: прямоугольник без скруглений, тип серым и мельче имени', async ({ page }) => {
  await page.goto('/');
  const node = await addNode(page, 'Сложить', 80, 80);
  await expect(node.locator('.flow-node__type')).toHaveText('Сложить');
  await expect(node.locator('.flow-node__name')).toHaveText('Сложить');
  expect(await style(card(node), 'border-top-left-radius')).toBe('0px');
  const typeColor = await style(node.locator('.flow-node__type'), 'color');
  const nameColor = await style(node.locator('.flow-node__name'), 'color');
  expect(typeColor).not.toBe(nameColor);
  const typeSize = parseFloat(await style(node.locator('.flow-node__type'), 'font-size'));
  const nameSize = parseFloat(await style(node.locator('.flow-node__name'), 'font-size'));
  expect(typeSize).toBeLessThan(nameSize);
});

test('US2 #2, #5, SC-007: переименование переживает перезагрузку, выгрузку и загрузку', async ({
  page,
}, info) => {
  await page.goto('/');
  const node = await addNode(page, 'Сложить', 80, 80);
  await rename(page, node, 'Итого');
  await expect(node.locator('.flow-node__name')).toHaveText('Итого');
  await expect(node.locator('.flow-node__type')).toHaveText('Сложить');
  await page.waitForTimeout(1000); // автосохранение — через 300 мс
  await page.reload();
  const again = page.locator('.react-flow__node').first();
  await expect(again.locator('.flow-node__name')).toHaveText('Итого');

  const download = page.waitForEvent('download');
  await (await openSidebar(page)).getByRole('button', { name: 'Выгрузить в файл' }).click();
  const path = info.outputPath('named.dagflow.json');
  await (await download).saveAs(path);
  expect(JSON.parse(readFileSync(path, 'utf8')).workflow.graph.nodes[0].name).toBe('Итого');
  await (await openSidebar(page)).getByLabel('Загрузить из файла').setInputFiles(path);
  await expect(tabBar(page).getByRole('tab')).toHaveCount(2);
  await expect(page.locator('.react-flow__node .flow-node__name')).toHaveText('Итого');
});

test('US2 #4: пустое имя и Escape не меняют имя', async ({ page }) => {
  await page.goto('/');
  const node = await addNode(page, 'Сложить', 80, 80);
  await node.locator('.flow-node__name').dblclick();
  const input = node.getByRole('textbox', { name: 'Имя нода' });
  await input.fill('   ');
  await input.press('Enter');
  await expect(node.getByRole('alert')).toHaveText(
    'Имя нода не может быть пустым. Введите хотя бы один символ.',
  );
  await input.press('Escape');
  await expect(node.locator('.flow-node__name')).toHaveText('Сложить');
});

test('FR-007a: ширина по имени от 20 до 40 символов, до 3 строк, высота одинакова', async ({
  page,
}) => {
  await page.goto('/');
  const short = await addNode(page, 'Число', 60, 60);
  const long = await addNode(page, 'Число', 60, 300);
  const longName = `${'длинное имя нода '.repeat(5)}конец`; // 90 символов
  await rename(page, long, longName);
  const a = (await card(short).boundingBox())!;
  const b = (await card(long).boundingBox())!;
  expect(b.width / a.width).toBeGreaterThan(1.7);
  expect(b.width / a.width).toBeLessThan(2.05);
  expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
  // Имя — не больше 3 строк (дальше — многоточие), полное — во всплывающей подсказке
  const name = long.locator('.flow-node__name');
  const lines = await name.evaluate(
    (el) => el.clientHeight / parseFloat(getComputedStyle(el).lineHeight),
  );
  expect(lines).toBeGreaterThan(1.5);
  expect(lines).toBeLessThanOrEqual(3.05);
  await expect(name).toHaveAttribute('title', longName);
  // Одно длинное слово переносится по символам и тоже не расширяет карточку
  await rename(page, short, 'Ж'.repeat(60));
  const c = (await card(short).boundingBox())!;
  expect(c.width).toBeLessThanOrEqual(b.width + 1);
});

test('US2 #6, #7: выделение — синяя рамка; состояние рамку не красит', async ({ page }) => {
  await page.goto('/');
  const a = await addNode(page, 'Число', 60, 60);
  const b = await addNode(page, 'Сложить', 60, 300); // ожидает входов
  const black = await style(card(a), 'border-top-color');
  expect(await style(card(b), 'border-top-color')).toBe(black);
  await expect(b.getByTestId('node-status')).toContainText('ожидает входов');
  await expect(b.locator('.flow-node__problem')).toContainText('Заполните вход');

  await selectNode(a);
  const blue = await style(card(a), 'border-top-color');
  expect(blue).not.toBe(black);
  await expect(card(a)).toHaveClass(/is-selected/);
  await page.keyboard.down('Shift');
  await selectNode(b);
  await page.keyboard.up('Shift');
  expect(await style(card(a), 'border-top-color')).toBe(blue);
  expect(await style(card(b), 'border-top-color')).toBe(blue);
  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 500 } });
  expect(await style(card(a), 'border-top-color')).toBe(black);
});

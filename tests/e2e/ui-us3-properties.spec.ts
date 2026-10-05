// US3 (фича 002): окно свойств выделенного нода
import { expect, test, type Locator, type Page } from '@playwright/test';
import { addNode, connect } from './helpers';

const grid = (page: Page) => page.getByRole('dialog', { name: 'Свойства' });
const row = (page: Page, side: 'in' | 'out', port: string) =>
  grid(page).locator(`li.prop-row[data-side="${side}"][data-port="${port}"]`);
const select = (node: Locator) => node.locator('.flow-node__title').click();

/** «Число 2», «Число 3» → «Сложить» (связи пока через порты карточки — до US4). */
async function sumGraph(page: Page) {
  await page.goto('/');
  const n1 = await addNode(page, 'Число', 40, 40);
  const n2 = await addNode(page, 'Число', 40, 240);
  const sum = await addNode(page, 'Сложить', 380, 120);
  await n1.getByLabel('value').fill('2');
  await n2.getByLabel('value').fill('3');
  await connect(page, n1, 'value', sum, 'a');
  await connect(page, n2, 'value', sum, 'b');
  return { n1, n2, sum };
}

test('US3 #1–#4: свойства «Сложить»; ввод в окне свойств пересчитывает граф', async ({ page }) => {
  const { n1, sum } = await sumGraph(page);
  await select(sum);
  await expect(grid(page)).toBeVisible();
  await expect(grid(page).getByTestId('prop-grid-name')).toHaveText('Сложить');
  await expect(grid(page).getByRole('region', { name: 'Входы' })).toBeVisible();
  await expect(grid(page).getByRole('region', { name: 'Выходы' })).toBeVisible();
  for (const [port, value] of [
    ['a', '2'],
    ['b', '3'],
  ] as const) {
    await expect(row(page, 'in', port).locator('.prop-type')).toHaveText('num');
    await expect(row(page, 'in', port).locator('.prop-marker')).toHaveClass(/is-linked/);
    await expect(row(page, 'in', port).locator('.prop-value')).toContainText(value);
    await expect(row(page, 'in', port).locator('.prop-source')).toHaveText('← Число.value');
  }
  await expect(row(page, 'out', 'result').locator('.prop-value')).toHaveText('5');

  // #3: значение «Числа» вводится в окне свойств
  await select(n1);
  await row(page, 'in', 'value').getByLabel('value', { exact: true }).fill('10');
  // #2: окно «Числа» открыто — значение выхода обновилось само
  await expect(row(page, 'out', 'value').locator('.prop-value')).toHaveText('10');
  await select(sum);
  await expect(row(page, 'out', 'result').locator('.prop-value')).toHaveText('13');
});

test('US3 #6: пустой холст и Escape скрывают окно; другой нод — его свойства', async ({ page }) => {
  const { n1, sum } = await sumGraph(page);
  await select(sum);
  await expect(grid(page).getByTestId('prop-grid-name')).toHaveText('Сложить');
  await select(n1);
  await expect(grid(page).getByTestId('prop-grid-name')).toHaveText('Число');
  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  await page.mouse.click(pane.x + 700, pane.y + 60);
  await expect(grid(page)).toHaveCount(0);
  await select(sum);
  await expect(grid(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(grid(page)).toHaveCount(0);
});

test('US3 (Clarifications): окно у правого края, не двигается вместе с холстом', async ({
  page,
}) => {
  const { n1, sum } = await sumGraph(page);
  await select(sum);
  const vp = page.viewportSize()!;
  const box = (await grid(page).boundingBox())!;
  expect(box.x + box.width).toBeGreaterThan(vp.width - 24);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);

  // Панорамирование и масштаб холста — окно на месте
  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  await page.mouse.move(pane.x + 600, pane.y + 380);
  await page.mouse.down();
  await page.mouse.move(pane.x + 500, pane.y + 330, { steps: 5 });
  await page.mouse.up();
  await page.mouse.wheel(0, 300);
  expect(await grid(page).boundingBox()).toEqual(box);

  // Передвинутое окно остаётся на новом месте при выделении другого нода
  const header = (await grid(page).locator('.floating__header').boundingBox())!;
  await page.mouse.move(header.x + 30, header.y + header.height / 2);
  await page.mouse.down();
  await page.mouse.move(header.x - 170, header.y + 100, { steps: 5 });
  await page.mouse.up();
  const moved = (await grid(page).boundingBox())!;
  expect(moved.x).toBeLessThan(box.x - 150);
  await select(n1);
  const after = (await grid(page).boundingBox())!;
  expect(after.x).toBeCloseTo(moved.x, 0);
  expect(after.y).toBeCloseTo(moved.y, 0);
});

test('US3 #7: при выделении двух нодов окна нет', async ({ page }) => {
  const { n1, n2 } = await sumGraph(page);
  await select(n1);
  await expect(grid(page)).toBeVisible();
  await page.keyboard.down('Shift');
  await select(n2);
  await page.keyboard.up('Shift');
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);
  await expect(grid(page)).toHaveCount(0);
});

test('US3 #8: у экземпляра составного нода — «Открыть» и «Развернуть»', async ({ page }) => {
  const { n1, sum } = await sumGraph(page);
  await select(n1);
  await page.keyboard.down('Shift');
  await select(sum);
  await page.keyboard.up('Shift');
  await page.getByRole('button', { name: 'Свернуть в составной нод' }).click();
  const dialog = page.getByRole('dialog', { name: 'Свернуть в составной нод' });
  await dialog.getByLabel('Имя составного нода').fill('Плюс два');
  await dialog.getByRole('button', { name: 'Свернуть' }).click();
  await select(page.locator('.react-flow__node').filter({ hasText: 'Плюс два' }));
  await expect(grid(page).getByRole('button', { name: 'Развернуть «Плюс два»' })).toBeVisible();
  await grid(page).getByRole('button', { name: 'Открыть составной нод «Плюс два»' }).click();
  await expect(page.getByTestId('tab-bar').getByRole('tab', { selected: true })).toHaveText(
    'Составной нод: Плюс два',
  );
});

test('US3 #9: у нода, ожидающего входов, — состояние и текст проблемы', async ({ page }) => {
  await page.goto('/');
  const div = await addNode(page, 'Разделить', 60, 60);
  await select(div);
  await expect(grid(page).getByTestId('node-status')).toContainText('ожидает входов');
  await expect(grid(page).getByTestId('node-message')).toContainText('a');
});

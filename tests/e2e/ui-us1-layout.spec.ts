// US1 (фича 002): холст во весь экран, левая панель и палитра — плавающие неблокирующие окна
import { expect, test, type Page } from '@playwright/test';
import { addNode, openPalette, openSidebar, paletteItem } from './helpers';

const sidebar = (page: Page) => page.getByRole('dialog', { name: 'Workflow и хранилище' });
const transform = (page: Page) =>
  page.locator('.react-flow__viewport').evaluate((el) => (el as HTMLElement).style.transform);

test('US1 #1, SC-001: вкладки и холст занимают всё окно, слева вверху кнопка меню', async ({
  page,
}) => {
  await page.goto('/');
  const vp = page.viewportSize()!;
  const menu = (await page.getByRole('button', { name: 'Меню' }).boundingBox())!;
  expect(menu.x).toBeLessThan(16);
  expect(menu.y).toBeLessThan(16);
  const bar = (await page.locator('.topbar').boundingBox())!;
  const canvas = (await page.getByTestId('canvas').boundingBox())!;
  expect(canvas.x).toBe(0);
  expect(canvas.width).toBe(vp.width);
  expect(Math.abs(canvas.y - (bar.y + bar.height))).toBeLessThanOrEqual(1);
  expect(Math.abs(canvas.y + canvas.height - vp.height)).toBeLessThanOrEqual(1);
  await expect(page.locator('aside.sidebar')).toHaveCount(0);
  await expect(sidebar(page)).toHaveCount(0);
});

test('US1 #2: ☰ показывает и скрывает левую панель; «Закрыть» и Escape её закрывают', async ({
  page,
}) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Меню' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(sidebar(page)).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(sidebar(page).getByTestId('workflow-list')).toBeVisible();
  await expect(sidebar(page).getByTestId('storage-indicator')).toBeVisible();
  await menu.click();
  await expect(sidebar(page)).toHaveCount(0);
  await menu.click();
  await sidebar(page).getByRole('button', { name: 'Закрыть' }).click();
  await expect(sidebar(page)).toHaveCount(0);
  await openSidebar(page);
  await page.keyboard.press('Escape');
  await expect(sidebar(page)).toHaveCount(0);
});

test('US1 #6: при открытой панели холст двигается, нод вне окна выделяется', async ({ page }) => {
  await page.goto('/');
  const vp = page.viewportSize()!;
  const node = await addNode(page, 'Число', vp.width / 2, 200);
  await openSidebar(page);
  const before = await transform(page);
  await page.mouse.move(vp.width - 300, vp.height - 150);
  await page.mouse.down();
  await page.mouse.move(vp.width - 200, vp.height - 100, { steps: 5 });
  await page.mouse.up();
  expect(await transform(page)).not.toBe(before);
  await node.click();
  await expect(node).toHaveClass(/selected/);
  await expect(sidebar(page)).toBeVisible();
});

test('US1 #3–#5: Пробел открывает палитру с вкладками; щелчок и перетаскивание добавляют нод', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('palette')).toHaveCount(0);
  const palette = await openPalette(page);
  await palette.getByRole('tab', { name: 'Арифметика' }).click();
  await expect(
    palette.locator('.palette__item-title').getByText('Сложить', { exact: true }),
  ).toBeVisible();
  await expect(
    palette.locator('.palette__item-title').getByText('Число', { exact: true }),
  ).toHaveCount(0);

  await palette.locator('.palette__item-title').getByText('Сложить', { exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(palette).toBeVisible();

  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  await (
    await paletteItem(page, 'Число')
  ).dragTo(page.locator('.react-flow__pane'), {
    targetPosition: { x: 150, y: 120 },
  });
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  const added = (await page.locator('.react-flow__node').nth(1).boundingBox())!;
  expect(Math.abs(added.x - (pane.x + 150))).toBeLessThan(40);
  expect(Math.abs(added.y - (pane.y + 120))).toBeLessThan(40);
  await expect(palette).toBeVisible();
  await page.keyboard.press('Space');
  await expect(palette).toHaveCount(0);
});

test('US1 #7: палитра, перетащенная за край, остаётся в окне', async ({ page }) => {
  await page.goto('/');
  const palette = await openPalette(page);
  const vp = page.viewportSize()!;
  const header = (await palette.locator('.floating__header').boundingBox())!;
  await page.mouse.move(header.x + 20, header.y + 5);
  await page.mouse.down();
  await page.mouse.move(-500, -500, { steps: 5 });
  await page.mouse.up();
  let box = (await palette.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  const h2 = (await palette.locator('.floating__header').boundingBox())!;
  await page.mouse.move(h2.x + 20, h2.y + 5);
  await page.mouse.down();
  await page.mouse.move(vp.width + 500, vp.height + 500, { steps: 5 });
  await page.mouse.up();
  box = (await palette.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
});

test('US1 #8: Пробел в поле ввода вводит пробел, палитра не открывается', async ({ page }) => {
  await page.goto('/');
  const panel = await openSidebar(page);
  await panel
    .getByRole('button', { name: /^Переименовать/ })
    .first()
    .click();
  const input = panel.getByLabel('Имя workflow');
  await input.fill('Отчёт');
  await input.press('Space');
  await expect(input).toHaveValue('Отчёт ');
  await expect(page.getByTestId('palette')).toHaveCount(0);
});

test('FR-006a: сообщение о хранилище — вверху левой панели, на кнопке меню точка', async ({
  page,
}) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Меню' });
  await expect(menu).toHaveAttribute('data-attention', 'true');
  await expect(menu.locator('.menu-button__dot')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Хранилище' })).toHaveCount(0);
  const panel = await openSidebar(page);
  const notice = panel.getByRole('region', { name: 'Хранилище' });
  // Chromium предлагает выбрать папку; без поддержки папок (Firefox) — сразу напоминание о выгрузке
  await expect(notice).toContainText(/Выберите рабочую папку|выгрузите workflow в файл/);
  // Сообщение — первым в панели, над индикатором хранилища
  const noticeBox = (await notice.boundingBox())!;
  const indicatorBox = (await panel.getByTestId('storage-indicator').boundingBox())!;
  expect(noticeBox.y).toBeLessThan(indicatorBox.y);
  const later = notice.getByRole('button', { name: 'Позже' });
  if (await later.isVisible()) await later.click();
  await panel
    .getByRole('region', { name: 'Хранилище' })
    .getByRole('button', { name: 'Понятно' })
    .click();
  await expect(menu).not.toHaveAttribute('data-attention');
});

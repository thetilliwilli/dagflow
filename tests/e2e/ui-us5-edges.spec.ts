// US5 (фича 002): одна прямая линия на пару нодов, подписи «выход→вход», окно связей
import { expect, test, type Page } from '@playwright/test';
import { addNode, connect, selectNode, valueOf } from './helpers';

const edges = (page: Page) => page.locator('.react-flow__edge');
const label = (page: Page) => page.locator('.bundle-label');
const lines = (page: Page) => label(page).locator('.bundle-label__line');
const linksWindow = (page: Page) => page.getByRole('dialog', { name: 'Links: Number → Add' });
const zoom = (page: Page) =>
  page
    .locator('.react-flow__viewport')
    .evaluate((el) => Number(/scale\(([\d.]+)\)/.exec((el as HTMLElement).style.transform)?.[1]));

async function pair(page: Page) {
  await page.goto('/');
  const num = await addNode(page, 'Number', 60, 100);
  const sum = await addNode(page, 'Add', 460, 100);
  await connect(page, num, 'value', sum, 'a');
  await connect(page, num, 'value', sum, 'b');
  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 450 } }); // снять выделение
  return { num, sum };
}

async function clickLine(page: Page) {
  const b = (await edges(page).first().locator('path').first().boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

test('US5 #1, #2, SC-004: одна прямая линия со стрелкой и подписью из двух строк', async ({
  page,
}) => {
  await pair(page);
  await expect(edges(page)).toHaveCount(1);
  const path = edges(page).locator('path.react-flow__edge-path');
  await expect(path).toHaveAttribute('d', /^M[^CQ]*L[^CQ]*$/);
  await expect(path).toHaveAttribute('marker-end', /url\(/);
  await expect(lines(page)).toHaveText(['value→a', 'value→b']);
  // Длинные имена обрезаются многоточием — полный текст во всплывающей подсказке
  await expect(lines(page).first()).toHaveAttribute('title', 'value→a');
});

test('US5 #3: при перемещении нода линия остаётся прямой, подпись едет с ней', async ({ page }) => {
  const { sum } = await pair(page);
  const before = (await label(page).boundingBox())!;
  const box = (await sum.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 6);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + 206, { steps: 6 });
  await page.mouse.up();
  await expect(edges(page).locator('path.react-flow__edge-path')).toHaveAttribute(
    'd',
    /^M[^CQ]*L[^CQ]*$/,
  );
  const after = (await label(page).boundingBox())!;
  expect(after.y).toBeGreaterThan(before.y + 50);
});

test('US5 #4–#7, SC-006: окно связей — удаление крестиком, отмена, закрытие', async ({ page }) => {
  const { sum } = await pair(page);
  // #4: щелчок по подписи
  await label(page).click();
  await expect(linksWindow(page).getByRole('listitem')).toHaveCount(2);
  await linksWindow(page).getByRole('button', { name: 'Close' }).click();
  await expect(linksWindow(page)).toHaveCount(0);
  // #4: щелчок по линии; #5, SC-006: второй щелчок — крестик
  await clickLine(page);
  await linksWindow(page).getByRole('button', { name: 'Delete link “value→b”' }).click();
  await expect(lines(page)).toHaveText(['value→a']);
  await expect(linksWindow(page).getByRole('listitem')).toHaveCount(1);
  // #7: пустой холст закрывает окно
  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 450 } });
  await expect(linksWindow(page)).toHaveCount(0);
  await selectNode(sum);
  const b = page.getByRole('dialog', { name: 'Properties' }).locator('li.prop-row[data-port="b"]');
  await expect(b.locator('.prop-marker')).not.toHaveClass(/is-linked/);
  // #6: отмена возвращает связь
  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 450 } });
  await page.keyboard.press('Control+z');
  await expect(lines(page)).toHaveText(['value→a', 'value→b']);
  // #7: Escape
  await label(page).click();
  await expect(linksWindow(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(linksWindow(page)).toHaveCount(0);
});

test('US5 #5: последняя связь удалена — линия и окно исчезают', async ({ page }) => {
  await pair(page);
  await label(page).click();
  await linksWindow(page).getByRole('button', { name: 'Delete link “value→a”' }).click();
  await linksWindow(page).getByRole('button', { name: 'Delete link “value→b”' }).click();
  await expect(edges(page)).toHaveCount(0);
  await expect(linksWindow(page)).toHaveCount(0);
});

test('US5 #8: при масштабе меньше 50% подписей нет, щелчок по линии работает', async ({ page }) => {
  await pair(page);
  const zoomOut = page.locator('.react-flow__controls-zoomout');
  while ((await zoom(page)) >= 0.5) await zoomOut.click();
  await expect(label(page)).toHaveCount(0);
  await expect(edges(page)).toHaveCount(1);
  await clickLine(page);
  await expect(linksWindow(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.react-flow__controls-zoomin').click();
  expect(await zoom(page)).toBeGreaterThanOrEqual(0.5);
  await expect(lines(page)).toHaveText(['value→a', 'value→b']);
});

test('выделенная линия + Delete удаляет все связи пучка одним шагом отмены', async ({ page }) => {
  const { sum } = await pair(page);
  await clickLine(page);
  // Закрыть окно связей кнопкой: Escape в React Flow снимает выделение с линии в фокусе
  await linksWindow(page).getByRole('button', { name: 'Close' }).click();
  await expect(edges(page).first()).toHaveClass(/selected/);
  await page.keyboard.press('Delete');
  await expect(edges(page)).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(lines(page)).toHaveText(['value→a', 'value→b']);
  await expect(await valueOf(page, sum, 'in', 'a')).toHaveText('0');
});

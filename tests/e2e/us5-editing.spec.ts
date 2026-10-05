import { expect, test } from '@playwright/test';
import { addNode, connect, paletteItem, setInput } from './helpers';

test('US5: большой граф, выделение рамкой, удаление, отмена и повтор, масштаб и мини-карта', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/');
  // 20 нодов щелчком по палитре (фича 002: одиночный щелчок)
  const item = await paletteItem(page, 'Число');
  for (let i = 0; i < 20; i++) await item.click();
  await expect(page.locator('.react-flow__node')).toHaveCount(20);

  // Отдельная пара нодов внизу холста
  const sum = await addNode(page, 'Сложить', 40, 560);
  const show = await addNode(page, 'Показать', 320, 560);
  await setInput(page, sum, 'a', '2');
  await setInput(page, sum, 'b', '5');
  await connect(page, sum, 'result', show, 'value');
  await expect(show.getByTestId('show-value')).toHaveText('7');
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  // Выделение рамкой (Shift + перетаскивание) вокруг пары
  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  await page.keyboard.down('Shift');
  await page.mouse.move(pane.x + 10, pane.y + 520);
  await page.mouse.down();
  await page.mouse.move(pane.x + 620, pane.y + pane.height - 10, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);

  // Delete удаляет ноды со связями (#2)
  await page.keyboard.press('Delete');
  await expect(page.locator('.react-flow__node')).toHaveCount(20);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);

  // Ctrl+Z возвращает, Ctrl+Shift+Z повторяет (#3)
  await page.keyboard.press('Control+z');
  await expect(page.locator('.react-flow__node')).toHaveCount(22);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Показать' }).getByTestId('show-value')).toHaveText('7');
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.react-flow__node')).toHaveCount(20);
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(22);

  // Масштаб и мини-карта (#1, FR-008)
  await expect(page.locator('.react-flow__minimap')).toBeVisible();
  const viewport = page.locator('.react-flow__viewport');
  const before = await viewport.getAttribute('style');
  await page.locator('.react-flow__controls-zoomout').click();
  await expect.poll(() => viewport.getAttribute('style')).not.toBe(before);
});

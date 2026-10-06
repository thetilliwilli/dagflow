import { expect, test } from '@playwright/test';
import { addNode, connect, openSidebar, tabBar, paletteItem, setInput, valueOf } from './helpers';

test('US4: свернуть, второй экземпляр, правка внутри, отказ рекурсии, выгрузка/загрузка', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/');
  // (a + b) × 2
  const n1 = await addNode(page, 'Number', 20, 40);
  const n2 = await addNode(page, 'Number', 20, 220);
  const add = await addNode(page, 'Add', 260, 120);
  const mul = await addNode(page, 'Multiply', 500, 120);
  const show = await addNode(page, 'Show', 740, 120);
  await setInput(page, n1, 'value', '2');
  await setInput(page, n2, 'value', '3');
  await setInput(page, mul, 'b', '2');
  await connect(page, n1, 'value', add, 'a');
  await connect(page, n2, 'value', add, 'b');
  await connect(page, add, 'result', mul, 'a');
  await connect(page, mul, 'result', show, 'value');
  await expect(await valueOf(page, show, 'in', 'value')).toHaveText('10');

  // 1. Свернуть
  await add.locator('.flow-node__name').click();
  await page.keyboard.down('Control');
  await mul.locator('.flow-node__name').click();
  await page.keyboard.up('Control');
  await page.getByRole('button', { name: 'Collapse into composite node' }).click();
  await page
    .getByRole('dialog', { name: 'Collapse into composite node' })
    .getByLabel('Composite node name')
    .fill('Удвоенная сумма');
  await page
    .getByRole('dialog', { name: 'Collapse into composite node' })
    .getByRole('button', { name: 'Collapse' })
    .click();
  // После сворачивания порядок нодов меняется — ищем по содержимому
  const showNode = page.locator('.react-flow__node').filter({ hasText: 'Show' });
  await expect(await valueOf(page, showNode, 'in', 'value')).toHaveText('10');
  await expect(page.locator('.react-flow__node')).toHaveCount(4);

  // 2. Второй экземпляр
  const second = await addNode(page, 'Удвоенная сумма', 500, 420);
  await setInput(page, second, 'a', '1');
  await setInput(page, second, 'b', '1');
  await expect(await valueOf(page, second, 'out', 'result')).toHaveText('4');

  // 3. Правка внутри: ×2 → ×3
  await page.getByRole('button', { name: 'Open composite node “Удвоенная сумма”' }).first().click();
  await expect(tabBar(page).getByRole('tab', { selected: true })).toHaveText(
    'Composite node: Удвоенная сумма',
  );
  const innerMul = page.locator('.react-flow__node').filter({ hasText: 'Multiply' });
  await setInput(page, innerMul, 'b', '3');

  // 4. Отказ рекурсии
  await addNodeExpectRejection();
  async function addNodeExpectRejection() {
    await (
      await paletteItem(page, 'Удвоенная сумма')
    ).dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: 300, y: 400 } });
    await expect(page.getByRole('alert')).toContainText('inside itself');
  }

  await tabBar(page).getByRole('tab', { name: 'New workflow' }).click();
  await expect(
    await valueOf(
      page,
      page.locator('.react-flow__node').filter({ hasText: 'Show' }),
      'in',
      'value',
    ),
  ).toHaveText('15');
  await expect(
    await valueOf(
      page,
      page.locator('.react-flow__node').filter({ hasText: 'Удвоенная сумма' }).last(),
      'out',
      'result',
    ),
  ).toHaveText('6');

  // 5. Выгрузка → удаление → загрузка
  const downloadPromise = page.waitForEvent('download');
  await (await openSidebar(page)).getByRole('button', { name: 'Export to file' }).click();
  const path = info.outputPath('composite.dagflow.json');
  await (await downloadPromise).saveAs(path);
  await paletteItem(page, 'Удвоенная сумма');
  await page.getByRole('button', { name: 'Delete composite node “Удвоенная сумма”' }).click();
  await page
    .getByRole('dialog', { name: 'Delete composite node?' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.getByTestId('palette').getByText('Удвоенная сумма')).toHaveCount(0);
  await (await openSidebar(page)).getByLabel('Import from file').setInputFiles(path);
  await expect(page.getByTestId('palette').getByText('Удвоенная сумма')).toHaveCount(1);
  await expect(
    await valueOf(
      page,
      page.locator('.react-flow__node').filter({ hasText: 'Show' }),
      'in',
      'value',
    ),
  ).toHaveText('15');
});

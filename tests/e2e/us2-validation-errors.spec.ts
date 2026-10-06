import { expect, test } from '@playwright/test';
import { addNode, connect, setInput, valueOf } from './helpers';

test('US2: связь, образующая цикл, отклоняется с объяснением', async ({ page }) => {
  await page.goto('/');
  const a = await addNode(page, 'Add', 40, 80);
  const b = await addNode(page, 'Add', 260, 260);
  const c = await addNode(page, 'Add', 480, 80);
  await connect(page, a, 'result', b, 'a');
  await connect(page, b, 'result', c, 'a');
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await connect(page, c, 'result', a, 'b');
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await expect(page.getByRole('alert')).toContainText('cycle');
});

test('US2: несовместимые типы отклоняются', async ({ page }) => {
  await page.goto('/');
  const t = await addNode(page, 'Text', 60, 80);
  const s = await addNode(page, 'Add', 400, 80);
  await connect(page, t, 'value', s, 'a');
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Incompatible types: text → number');
});

test('US2: деление на ноль → ошибка на ноде, исправление → ошибка исчезла; независимая ветка работает', async ({
  page,
}) => {
  await page.goto('/');
  const div = await addNode(page, 'Divide', 60, 60);
  const show = await addNode(page, 'Show', 420, 60);
  const add = await addNode(page, 'Add', 60, 340);
  const show2 = await addNode(page, 'Show', 420, 340);
  await setInput(page, div, 'a', '1');
  await setInput(page, div, 'b', '0');
  await setInput(page, add, 'a', '2');
  await setInput(page, add, 'b', '3');
  await connect(page, div, 'result', show, 'value');
  await connect(page, add, 'result', show2, 'value');

  await expect(div.getByTestId('node-message')).toHaveText(
    'Division by zero: set a non-zero divisor.',
  );
  await expect(show.getByTestId('node-status')).toContainText('not computed: upstream problem');
  await expect(await valueOf(page, show2, 'in', 'value')).toHaveText('5');

  await setInput(page, div, 'b', '4');
  await expect(div.getByTestId('node-message')).toHaveCount(0);
  await expect(await valueOf(page, show, 'in', 'value')).toHaveText('0.25');
});

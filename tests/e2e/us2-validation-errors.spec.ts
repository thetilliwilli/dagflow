import { expect, test } from '@playwright/test';
import { addNode, connect } from './helpers';

test('US2: связь, образующая цикл, отклоняется с объяснением', async ({ page }) => {
  await page.goto('/');
  const a = await addNode(page, 'Сложить', 60, 80);
  const b = await addNode(page, 'Сложить', 360, 80);
  const c = await addNode(page, 'Сложить', 660, 80);
  await connect(page, a, 'result', b, 'a');
  await connect(page, b, 'result', c, 'a');
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await connect(page, c, 'result', a, 'b');
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await expect(page.getByRole('alert')).toContainText('цикл');
});

test('US2: несовместимые типы отклоняются', async ({ page }) => {
  await page.goto('/');
  const t = await addNode(page, 'Текст', 60, 80);
  const s = await addNode(page, 'Сложить', 400, 80);
  await connect(page, t, 'value', s, 'a');
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Несовместимые типы: текст → число');
});

test('US2: деление на ноль → ошибка на ноде, исправление → ошибка исчезла; независимая ветка работает', async ({ page }) => {
  await page.goto('/');
  const div = await addNode(page, 'Разделить', 60, 60);
  const show = await addNode(page, 'Показать', 420, 60);
  const add = await addNode(page, 'Сложить', 60, 340);
  const show2 = await addNode(page, 'Показать', 420, 340);
  await div.getByLabel('a').fill('1');
  await div.getByLabel('b').fill('0');
  await add.getByLabel('a').fill('2');
  await add.getByLabel('b').fill('3');
  await connect(page, div, 'result', show, 'value');
  await connect(page, add, 'result', show2, 'value');

  await expect(div.getByTestId('node-message')).toHaveText('Деление на ноль: задайте ненулевой делитель');
  await expect(show.getByTestId('node-status')).toContainText('не вычислен: проблема выше по графу');
  await expect(show2.getByTestId('show-value')).toHaveText('5');

  await div.getByLabel('b').fill('4');
  await expect(div.getByTestId('node-message')).toHaveCount(0);
  await expect(show.getByTestId('show-value')).toHaveText('0.25');
});

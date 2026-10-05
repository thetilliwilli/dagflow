import { expect, test } from '@playwright/test';
import { addNode, connect } from './helpers';

test('US1: 2 + 3 = 5, затем 10 + 3 = 13 без дополнительных действий', async ({ page }) => {
  await page.goto('/');
  const n1 = await addNode(page, 'Число', 80, 60);
  const n2 = await addNode(page, 'Число', 80, 260);
  const sum = await addNode(page, 'Сложить', 420, 140);
  const show = await addNode(page, 'Показать', 760, 140);

  await n1.getByLabel('value').fill('2');
  await n2.getByLabel('value').fill('3');
  await connect(page, n1, 'value', sum, 'a');
  await connect(page, n2, 'value', sum, 'b');
  await connect(page, sum, 'result', show, 'value');

  await expect(show.getByTestId('show-value')).toHaveText('5');
  await n1.getByLabel('value').fill('10');
  await expect(show.getByTestId('show-value')).toHaveText('13');
});

test('US1 #3: изменение входа A обновляет C в цепочке A → B → C', async ({ page }) => {
  await page.goto('/');
  const a = await addNode(page, 'Число', 80, 100);
  const b = await addNode(page, 'Умножить', 400, 100);
  const c = await addNode(page, 'Показать', 740, 100);
  await a.getByLabel('value').fill('4');
  await b.getByLabel('b').fill('2');
  await connect(page, a, 'value', b, 'a');
  await connect(page, b, 'result', c, 'value');
  await expect(c.getByTestId('show-value')).toHaveText('8');
  await a.getByLabel('value').fill('6');
  await expect(c.getByTestId('show-value')).toHaveText('12');
});

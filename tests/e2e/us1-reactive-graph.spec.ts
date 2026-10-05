import { expect, test, type Locator, type Page } from '@playwright/test';

/** Перетаскивает нод из палитры на холст в точку (x, y) относительно холста. */
async function addNode(page: Page, title: string, x: number, y: number): Promise<Locator> {
  const before = await page.locator('.react-flow__node').count();
  await page
    .getByTestId('palette')
    .getByText(title, { exact: true })
    .dragTo(page.locator('.react-flow__pane'), { targetPosition: { x, y } });
  const node = page.locator('.react-flow__node').nth(before);
  await expect(node).toBeVisible();
  return node;
}

/** Тянет связь от выхода одного нода ко входу другого. */
async function connect(page: Page, from: Locator, out: string, to: Locator, input: string) {
  const src = from.locator(`[data-handleid="out:${out}"]`);
  const dst = to.locator(`[data-handleid="in:${input}"]`);
  const a = (await src.boundingBox())!;
  const b = (await dst.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

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

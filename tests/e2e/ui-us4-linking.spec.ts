// US4 (фича 002): связывание свойств перетаскиванием и режимом привязки по маркеру
import { expect, test, type Locator, type Page } from '@playwright/test';
import { addNode, connect, linkByClick, selectNode, setInput } from './helpers';

const grid = (page: Page) => page.getByRole('dialog', { name: 'Properties' });
const gridRow = (page: Page, side: 'in' | 'out', port: string) =>
  grid(page).locator(`li.prop-row[data-side="${side}"][data-port="${port}"]`);
const peekRow = async (page: Page, node: Locator, side: 'in' | 'out', port: string) =>
  page.locator(
    `[data-peek-node="${await node.getAttribute('data-id')}"] li.prop-row[data-side="${side}"][data-port="${port}"]`,
  );
const center = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const edges = (page: Page) => page.locator('.react-flow__edge');
const transform = (page: Page) =>
  page.locator('.react-flow__viewport').evaluate((el) => (el as HTMLElement).style.transform);

/** Начать перетаскивание строки окна свойств и навести на нод (без отпускания). */
async function startDrag(
  page: Page,
  from: Locator,
  side: 'in' | 'out',
  port: string,
  over: Locator,
) {
  await selectNode(from);
  const src = await center(gridRow(page, side, port).locator('.prop-name'));
  await page.mouse.move(src.x, src.y);
  await page.mouse.down();
  const t = await center(over);
  await page.mouse.move(t.x, t.y, { steps: 8 });
}

test('US4 #1–#3, SC-003: перетаскивание выхода на совместимый вход; недоступное — серое, строки на месте', async ({
  page,
}) => {
  await page.goto('/');
  const num = await addNode(page, 'Number', 40, 60);
  const sum = await addNode(page, 'Add', 380, 60);
  await setInput(page, num, 'value', '2');
  await setInput(page, sum, 'b', '3');
  const before = await transform(page);
  await startDrag(page, num, 'out', 'value', sum);
  // #1: метка за курсором, холст не двигается
  await expect(page.locator('.link-ghost')).toContainText('value');
  expect(await transform(page)).toBe(before);
  // #2: временное окно; выход «Сложить» серый, входы доступны
  const a = await peekRow(page, sum, 'in', 'a');
  const result = await peekRow(page, sum, 'out', 'result');
  await expect(a).toBeVisible();
  await expect(result).toHaveClass(/is-disabled/);
  await expect(a).not.toHaveClass(/is-disabled/);
  // SC-003: строки не сдвигаются, пока курсор ходит по окну
  const rows = (await page.locator(`[data-peek-node] li.prop-row`).all()).map((r) =>
    r.boundingBox(),
  );
  const firstBoxes = await Promise.all(rows);
  const p1 = await center(result);
  await page.mouse.move(p1.x, p1.y);
  const secondBoxes = await Promise.all(
    (await page.locator(`[data-peek-node] li.prop-row`).all()).map((r) => r.boundingBox()),
  );
  expect(secondBoxes).toEqual(firstBoxes);
  // #3: бросок на вход «a»
  const pa = await center(a);
  await page.mouse.move(pa.x, pa.y);
  await page.mouse.up();
  await expect(edges(page)).toHaveCount(1);
  await expect(page.locator('[data-peek-node]')).toHaveCount(0);
  await expect(grid(page)).toBeVisible();
  await expect(gridRow(page, 'out', 'value').locator('.prop-marker')).toHaveClass(/is-linked/);
  await selectNode(sum);
  await expect(gridRow(page, 'out', 'result').locator('.prop-value')).toHaveText('5');
  // #13: маркеры источника и цели зелёные
  await expect(gridRow(page, 'in', 'a').locator('.prop-marker')).toHaveClass(/is-linked/);
});

test('US4 #5: бросок на недоступную строку — связи нет, сообщение с причиной', async ({ page }) => {
  await page.goto('/');
  const text = await addNode(page, 'Text', 40, 60);
  const sum = await addNode(page, 'Add', 380, 60);
  await startDrag(page, text, 'out', 'value', sum);
  const b = await peekRow(page, sum, 'in', 'b');
  await expect(b).toHaveClass(/is-disabled/);
  const pb = await center(b);
  await page.mouse.move(pb.x, pb.y);
  await page.mouse.up();
  await expect(edges(page)).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText(
    'Incompatible types: text → number. Link ports of the same type or use a port of type “any”.',
  );

  await startDrag(page, text, 'out', 'value', sum);
  const res = await peekRow(page, sum, 'out', 'result');
  const pr = await center(res);
  await page.mouse.move(pr.x, pr.y);
  await page.mouse.up();
  await expect(page.getByRole('alert').last()).toContainText(
    'Cannot link an output to an output: a link goes from an output of one node to an input of another.',
  );
  await expect(edges(page)).toHaveCount(0);
});

test('US4 #5: цикл отклоняется с объяснением', async ({ page }) => {
  await page.goto('/');
  const a = await addNode(page, 'Add', 40, 60);
  const b = await addNode(page, 'Add', 380, 60);
  await connect(page, a, 'result', b, 'a');
  await startDrag(page, b, 'out', 'result', a);
  const row = await peekRow(page, a, 'in', 'b');
  await expect(row).toHaveClass(/is-disabled/);
  await expect(row).toHaveAttribute('title', /create a cycle/);
  const p = await center(row);
  await page.mouse.move(p.x, p.y);
  await page.mouse.up();
  await expect(page.getByRole('alert')).toContainText(
    'Cannot link: this connection would create a cycle, and the graph must stay acyclic.',
  );
  await expect(edges(page)).toHaveCount(1);
});

test('US4 #4: перетаскивание входа на выход создаёт связь в обратную сторону', async ({ page }) => {
  await page.goto('/');
  const num = await addNode(page, 'Number', 40, 60);
  const sum = await addNode(page, 'Add', 380, 60);
  await setInput(page, num, 'value', '4');
  await setInput(page, sum, 'a', '1');
  await startDrag(page, sum, 'in', 'b', num);
  const out = await peekRow(page, num, 'out', 'value');
  await expect(await peekRow(page, num, 'in', 'value')).toHaveClass(/is-disabled/);
  const p = await center(out);
  await page.mouse.move(p.x, p.y);
  await page.mouse.up();
  await expect(edges(page)).toHaveCount(1);
  await expect(gridRow(page, 'in', 'b').locator('.prop-source')).toHaveText('← Number.value');
  await expect(gridRow(page, 'out', 'result').locator('.prop-value')).toHaveText('5');
});

test('US4 #6: бросок на пустой холст и Escape ничего не меняют', async ({ page }) => {
  await page.goto('/');
  const num = await addNode(page, 'Number', 40, 60);
  const sum = await addNode(page, 'Add', 380, 60);
  await startDrag(page, num, 'out', 'value', sum);
  await page.mouse.move(700, 500, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator('[data-peek-node]')).toHaveCount(0);
  await startDrag(page, num, 'out', 'value', sum);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-peek-node]')).toHaveCount(0);
  await expect(page.locator('.link-ghost')).toHaveCount(0);
  await page.mouse.up();
  await expect(edges(page)).toHaveCount(0);
  await expect(grid(page)).toBeVisible();
});

test('US4 #7: бросок на занятый вход заменяет связь, Ctrl+Z возвращает прежнюю', async ({
  page,
}) => {
  await page.goto('/');
  const n1 = await addNode(page, 'Number', 40, 40);
  const n2 = await addNode(page, 'Number', 40, 240);
  const sum = await addNode(page, 'Add', 380, 120);
  await setInput(page, n1, 'value', '1');
  await setInput(page, n2, 'value', '7');
  await setInput(page, sum, 'b', '0');
  await connect(page, n1, 'value', sum, 'a');
  await connect(page, n2, 'value', sum, 'a');
  await expect(edges(page)).toHaveCount(1);
  await selectNode(sum);
  await expect(gridRow(page, 'out', 'result').locator('.prop-value')).toHaveText('7');
  await page.locator('.react-flow__pane').click({ position: { x: 700, y: 400 } });
  await page.keyboard.press('Control+z');
  await selectNode(sum);
  await expect(gridRow(page, 'out', 'result').locator('.prop-value')).toHaveText('1');
});

test('US4 #8: курсор переходит с нода B на нод C — окно меняется', async ({ page }) => {
  await page.goto('/');
  const num = await addNode(page, 'Number', 40, 60);
  const b = await addNode(page, 'Add', 380, 40);
  const c = await addNode(page, 'Show', 380, 300);
  await startDrag(page, num, 'out', 'value', b);
  await expect(page.locator(`[data-peek-node="${await b.getAttribute('data-id')}"]`)).toBeVisible();
  const pc = await center(c);
  await page.mouse.move(pc.x, pc.y, { steps: 6 });
  await expect(page.locator(`[data-peek-node="${await c.getAttribute('data-id')}"]`)).toBeVisible();
  await expect(page.locator(`[data-peek-node="${await b.getAttribute('data-id')}"]`)).toHaveCount(
    0,
  );
  await page.keyboard.press('Escape');
  await page.mouse.up();
});

test('US4 #9–#13: режим привязки щелчком по маркеру', async ({ page }) => {
  await page.goto('/');
  const text = await addNode(page, 'Text', 40, 40);
  const num = await addNode(page, 'Number', 40, 260);
  const sum = await addNode(page, 'Add', 380, 120);
  await setInput(page, num, 'value', '6');
  await setInput(page, sum, 'b', '1');

  // #9: щелчок по маркеру — режим привязки
  await selectNode(text);
  const marker = gridRow(page, 'out', 'value').locator('.prop-marker');
  await marker.click();
  await expect(marker).toHaveAttribute('aria-pressed', 'true');
  await expect(grid(page)).toContainText('Pick a node and a property to link');
  // #10–#11: щелчок по ноду — временное окно; щелчок по серой строке — сообщение, режим продолжается
  await selectNode(sum);
  const b = await peekRow(page, sum, 'in', 'b');
  await expect(b).toHaveClass(/is-disabled/);
  await b.click();
  await expect(page.getByRole('alert')).toContainText('Incompatible types: text → number');
  await expect(marker).toHaveAttribute('aria-pressed', 'true');
  await expect(grid(page).getByTestId('prop-grid-name')).toHaveText('Text');
  // #12: Escape завершает режим
  await page.keyboard.press('Escape');
  await expect(marker).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-peek-node]')).toHaveCount(0);
  // повторный щелчок по маркеру тоже завершает
  await marker.click();
  await marker.click();
  await expect(marker).toHaveAttribute('aria-pressed', 'false');

  // #10, #13: привязка «Числа» щелчками
  await linkByClick(page, num, 'out', 'value', sum, 'in', 'a');
  await expect(edges(page)).toHaveCount(1);
  await expect(gridRow(page, 'out', 'value').locator('.prop-marker')).toHaveClass(/is-linked/);
  await selectNode(sum);
  await expect(gridRow(page, 'in', 'a').locator('.prop-marker')).toHaveClass(/is-linked/);
  await expect(gridRow(page, 'out', 'result').locator('.prop-value')).toHaveText('7');
});

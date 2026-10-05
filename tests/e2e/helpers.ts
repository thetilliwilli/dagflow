import { expect, type Locator, type Page } from '@playwright/test';

/** Перетаскивает нод из палитры на холст в точку (x, y) относительно холста. */
export async function addNode(page: Page, title: string, x: number, y: number): Promise<Locator> {
  const before = await page.locator('.react-flow__node').count();
  await page
    .getByTestId('palette')
    .locator('.palette__item-title')
    .getByText(title, { exact: true })
    .dragTo(page.locator('.react-flow__pane'), { targetPosition: { x, y } });
  const node = page.locator('.react-flow__node').nth(before);
  await expect(node).toBeVisible();
  return node;
}

/** Тянет связь от выхода одного нода ко входу другого. */
export async function connect(page: Page, from: Locator, out: string, to: Locator, input: string) {
  const a = (await from.locator(`[data-handleid="out:${out}"]`).boundingBox())!;
  const b = (await to.locator(`[data-handleid="in:${input}"]`).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

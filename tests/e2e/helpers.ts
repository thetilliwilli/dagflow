import { expect, type Locator, type Page } from '@playwright/test';

/** Убирает фокус из полей ввода: Пробел и Escape тогда работают как горячие клавиши редактора. */
async function blurActive(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** Открывает палитру Пробелом (если закрыта): полоса внизу по центру холста. */
export async function openPalette(page: Page): Promise<Locator> {
  const palette = page.getByTestId('palette');
  if (await palette.isVisible()) return palette;
  await blurActive(page);
  await page.keyboard.press('Space');
  await expect(palette).toBeVisible();
  return palette;
}

/** Находит элемент палитры по названию нода, переключая вкладки категорий. */
export async function paletteItem(page: Page, title: string): Promise<Locator> {
  const palette = await openPalette(page);
  const item = palette.locator('.palette__item-title').getByText(title, { exact: true });
  if (await item.isVisible()) return item;
  for (const tab of await palette.getByRole('tab').all()) {
    await tab.click();
    if (await item.isVisible()) return item;
  }
  throw new Error(`В палитре нет нода «${title}»`);
}

/** Закрывает палитру, если она открыта. */
export async function closePalette(page: Page) {
  if (!(await page.getByTestId('palette').isVisible())) return;
  await blurActive(page);
  await page.keyboard.press('Space');
  await expect(page.getByTestId('palette')).toHaveCount(0);
}

/**
 * Перетаскивает нод из палитры на холст в точку (x, y) относительно холста и закрывает
 * палитру: полоса палитры внизу иначе закрывала бы ноды в нижней части холста.
 */
export async function addNode(page: Page, title: string, x: number, y: number): Promise<Locator> {
  await closeSidebar(page); // левая панель стоит у левого края и закрыла бы точку броска
  const before = await page.locator('.react-flow__node').count();
  const item = await paletteItem(page, title);
  await item.dragTo(page.locator('.react-flow__pane'), { targetPosition: { x, y } });
  const node = page.locator('.react-flow__node').nth(before);
  await expect(node).toBeVisible();
  await closePalette(page);
  return node;
}

/** Открывает левую панель (список workflow, хранилище, выгрузка и загрузка) кнопкой меню. */
export async function openSidebar(page: Page): Promise<Locator> {
  const sidebar = page.getByRole('dialog', { name: 'Workflow и хранилище' });
  if (!(await sidebar.isVisible())) await page.getByRole('button', { name: 'Меню' }).click();
  await expect(sidebar).toBeVisible();
  return sidebar;
}

/** Закрывает левую панель, если она открыта. */
export async function closeSidebar(page: Page) {
  const menu = page.getByRole('button', { name: 'Меню' });
  if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
}

/** Полоса вкладок workflow (у палитры тоже есть вкладки — категории). */
export function tabBar(page: Page): Locator {
  return page.getByTestId('tab-bar');
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

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
  const sidebar = page.getByRole('dialog', { name: 'Workflows & storage' });
  if (!(await sidebar.isVisible())) await page.getByRole('button', { name: 'Menu' }).click();
  await expect(sidebar).toBeVisible();
  return sidebar;
}

/** Закрывает левую панель, если она открыта. */
export async function closeSidebar(page: Page) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
}

/** Полоса вкладок workflow (у палитры тоже есть вкладки — категории). */
export function tabBar(page: Page): Locator {
  return page.getByTestId('tab-bar');
}

/** Выделяет нод щелчком по заголовку карточки. */
export async function selectNode(node: Locator) {
  await node.locator('.flow-node__name').click();
}

const propsRow = (page: Page, side: 'in' | 'out', port: string) =>
  page
    .getByRole('dialog', { name: 'Properties' })
    .locator(`li.prop-row[data-side="${side}"][data-port="${port}"]`);

const peekRow = async (page: Page, node: Locator, side: 'in' | 'out', port: string) =>
  page.locator(
    `[data-peek-node="${await node.getAttribute('data-id')}"] li.prop-row[data-side="${side}"][data-port="${port}"]`,
  );

async function centerOf(l: Locator) {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Выделяет нод и вводит значение входа в окне «Свойства». */
export async function setInput(page: Page, node: Locator, port: string, value: string) {
  await selectNode(node);
  await propsRow(page, 'in', port).getByLabel(port, { exact: true }).fill(value);
}

/** Значение параметра нода: выделить нод и взять значение строки в окне «Свойства» (US2: на карточке значений нет). */
export async function valueOf(
  page: Page,
  node: Locator,
  side: 'in' | 'out',
  port: string,
): Promise<Locator> {
  await selectNode(node);
  return propsRow(page, side, port).locator('.prop-value .value-view');
}

/** Поле ввода входа выделенного нода в окне «Свойства» (для проверки значения). */
export async function inputField(page: Page, node: Locator, port: string): Promise<Locator> {
  await selectNode(node);
  return propsRow(page, 'in', port).getByLabel(port, { exact: true });
}

/**
 * Связывает выход `out` нода `from` со входом `input` нода `to` перетаскиванием (US4):
 * строка из окна «Свойства» → нод → строка временного окна.
 */
export async function connect(page: Page, from: Locator, out: string, to: Locator, input: string) {
  await selectNode(from);
  const src = await centerOf(propsRow(page, 'out', out).locator('.prop-name'));
  await page.mouse.move(src.x, src.y);
  await page.mouse.down();
  // К ноду — сверху: временное окно нода, над которым прошёл курсор, может закрыть цель
  const over = await centerOf(to.locator('.flow-node__name'));
  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  await page.mouse.move(over.x, pane.y + 4, { steps: 4 });
  await page.mouse.move(over.x, over.y, { steps: 4 });
  const target = await peekRow(page, to, 'in', input);
  await expect(target).toBeVisible();
  // Одним шагом: путь до окна не должен задевать другие ноды
  const dst = await centerOf(target);
  await page.mouse.move(dst.x, dst.y);
  await page.mouse.up();
}

/** Связывает щелчками (режим привязки, FR-018a): маркер → нод → строка временного окна. */
export async function linkByClick(
  page: Page,
  from: Locator,
  side: 'in' | 'out',
  port: string,
  to: Locator,
  toSide: 'in' | 'out',
  toPort: string,
) {
  await selectNode(from);
  await propsRow(page, side, port).locator('.prop-marker').click();
  await to.locator('.flow-node__name').click();
  await (await peekRow(page, to, toSide, toPort)).click();
}

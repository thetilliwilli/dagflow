// Фича 003, US3: работа, сохранённая до перевода, открывается и вычисляется (FR-010, SC-005)
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { closePalette, openPalette, openSidebar, tabBar, valueOf } from './helpers';

const fixture = fileURLToPath(new URL('./fixtures/legacy-002-export.json', import.meta.url));
const byName = (page: Page, name: string) =>
  page
    .locator('.react-flow__node')
    .filter({ has: page.locator('.flow-node__name', { hasText: name }) });

test('US3 #1, #2, SC-005: выгрузка формата 002 с русскими именами открывается и вычисляется', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/');
  await (await openSidebar(page)).getByLabel('Import from file').setInputFiles(fixture);
  await expect(tabBar(page).getByRole('tab', { selected: true })).toHaveText('Расчёт');

  // #1: те же значения, что до фичи
  await expect(await valueOf(page, byName(page, 'Показать'), 'in', 'value')).toHaveText('5');
  await expect(await valueOf(page, byName(page, 'Удвоить'), 'out', 'результат')).toHaveText('10');

  // #2: имя по умолчанию из 002 сохранилось, тип — по-английски
  const add = byName(page, 'Сложить');
  await expect(add.locator('.flow-node__name')).toHaveText('Сложить');
  await expect(add.locator('.flow-node__type')).toHaveText('Add');
  await expect(byName(page, 'Удвоить').locator('.flow-node__type')).toHaveText('Удвоить');

  // Составной нод — в палитре на своей вкладке
  const palette = await openPalette(page);
  await palette.getByRole('tab', { name: 'My composite nodes' }).click();
  await expect(
    palette.locator('.palette__item-title').getByText('Удвоить', { exact: true }),
  ).toBeVisible();
  await closePalette(page);

  // Имя можно переименовать как обычно (во время правки имени фильтр по имени не сработает — по data-id)
  const addNode = page.locator(`.react-flow__node[data-id="${await add.getAttribute('data-id')}"]`);
  await addNode.locator('.flow-node__name').dblclick();
  const input = addNode.getByRole('textbox', { name: 'Node name' });
  await input.fill('Sum');
  await input.press('Enter');
  await expect(byName(page, 'Sum').locator('.flow-node__type')).toHaveText('Add');
});

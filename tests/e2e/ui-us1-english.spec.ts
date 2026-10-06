// Фича 003, US1: весь интерфейс на английском (FR-001 – FR-006, SC-001)
import { expect, test, type Page } from '@playwright/test';
import {
  addNode,
  closeSidebar,
  connect,
  openPalette,
  openSidebar,
  selectNode,
  setInput,
  tabBar,
} from './helpers';

const CYRILLIC = /[А-Яа-яЁё]/;

/** Ни в тексте страницы, ни в подсказках и подписях для читалок нет кириллицы (SC-001). */
async function expectNoCyrillic(page: Page, step: string) {
  const found = await page.evaluate((source) => {
    const re = new RegExp(source);
    const hits: string[] = [];
    if (re.test(document.title)) hits.push(`title: ${document.title}`);
    if (re.test(document.body.textContent ?? '')) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode())
        if (re.test(n.textContent ?? '')) hits.push(`text: ${n.textContent}`);
    }
    for (const el of document.querySelectorAll('[title], [aria-label], [placeholder]')) {
      for (const attr of ['title', 'aria-label', 'placeholder']) {
        const v = el.getAttribute(attr);
        if (v && re.test(v)) hits.push(`${attr}: ${v}`);
      }
    }
    return hits;
  }, CYRILLIC.source);
  expect(found, step).toEqual([]);
}

test('US1 #1–#7, SC-001: обход интерфейса и типовых ошибок без кириллицы', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/');

  // #1, #7: рабочая область и страница
  expect(await page.title()).toBe('DAG Flow');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  await expect(tabBar(page).getByRole('tab', { selected: true })).toHaveText('New workflow');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeVisible();
  await expectNoCyrillic(page, 'рабочая область');

  // #2: левая панель
  const sidebar = await openSidebar(page);
  await expect(sidebar.getByRole('heading', { name: 'Workflows' })).toBeVisible();
  for (const name of ['Create workflow', 'Export to file'])
    await expect(sidebar.getByRole('button', { name })).toBeVisible();
  await expect(sidebar.getByLabel('Import from file')).toBeAttached();
  await expect(sidebar.getByRole('link', { name: 'github' })).toBeVisible();
  await expectNoCyrillic(page, 'левая панель');
  await closeSidebar(page);

  // #3: палитра — все вкладки
  const palette = await openPalette(page);
  for (const tab of await palette.getByRole('tab').all()) {
    await tab.click();
    await expectNoCyrillic(page, `палитра: ${await tab.textContent()}`);
  }
  await palette.getByRole('tab', { name: 'Math' }).click();
  await expect(palette.locator('.palette__item').filter({ hasText: 'Add' }).first()).toContainText(
    'a + b',
  );

  // #3, #4: новый нод — английское имя по умолчанию; окно свойств и состояние
  const add = await addNode(page, 'Add', 300, 80);
  await expect(add.locator('.flow-node__name')).toHaveText('Add');
  await expect(add.locator('.flow-node__type')).toHaveText('Add');
  await selectNode(add);
  const props = page.getByRole('dialog', { name: 'Properties' });
  await expect(props).toContainText('Inputs');
  await expect(props).toContainText('Outputs');
  await expect(add.getByTestId('node-status')).toContainText('waiting for inputs');
  await expect(add.getByTestId('node-message')).toHaveText('Fill in input “a”.');
  await expectNoCyrillic(page, 'окно свойств');

  // #5: несовместимые типы
  const text = await addNode(page, 'Text', 40, 80);
  await connect(page, text, 'value', add, 'a');
  await expect(page.getByRole('alert').last()).toContainText(
    'Incompatible types: text → number. Link ports of the same type or use a port of type “any”.',
  );

  // #5: цикл
  const num = await addNode(page, 'Number', 40, 300);
  const add2 = await addNode(page, 'Add', 560, 300);
  await connect(page, num, 'value', add, 'a');
  await connect(page, add, 'result', add2, 'a');
  await connect(page, add2, 'result', add, 'b');
  await expect(page.getByRole('alert').last()).toContainText(
    'Cannot link: this connection would create a cycle, and the graph must stay acyclic.',
  );

  // #5: деление на ноль
  const div = await addNode(page, 'Divide', 300, 560);
  await setInput(page, div, 'a', '1');
  await setInput(page, div, 'b', '0');
  await expect(div.getByTestId('node-message')).toHaveText(
    'Division by zero: set a non-zero divisor.',
  );

  // #5: пустое имя
  await div.locator('.flow-node__name').dblclick();
  const nameInput = div.getByRole('textbox', { name: 'Node name' });
  await nameInput.fill('   ');
  await nameInput.press('Enter');
  await expect(div.getByRole('alert')).toHaveText(
    'The node name cannot be empty. Enter at least one character.',
  );
  await expectNoCyrillic(page, 'ошибки на холсте');
  await nameInput.press('Escape');

  // #6: окно связей
  await page.locator('.react-flow__pane').click({ position: { x: 1500, y: 850 } }); // снять выделение
  await page.locator('.bundle-label').first().click();
  const links = page.getByRole('dialog', { name: /^Links: / });
  await expect(links).toBeVisible();
  await expect(links.getByRole('button', { name: /^Delete link “/ }).first()).toBeVisible();
  await expectNoCyrillic(page, 'окно связей');
  await links.getByRole('button', { name: 'Close' }).click();

  // #5: некорректный файл
  await (await openSidebar(page)).getByLabel('Import from file').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('plain text'),
  });
  const importError = page.getByRole('dialog', { name: 'Could not load the file' });
  await expect(importError).toContainText('The file is not valid JSON.');
  await expectNoCyrillic(page, 'ошибка загрузки');
  await importError.getByRole('button', { name: 'Close', exact: true }).click();

  // #6: диалог подтверждения
  await (await openSidebar(page)).getByRole('button', { name: 'Delete “New workflow”' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete workflow?' })).toContainText(
    'Workflow “New workflow” will be deleted permanently.',
  );
  await expectNoCyrillic(page, 'диалог удаления');
});

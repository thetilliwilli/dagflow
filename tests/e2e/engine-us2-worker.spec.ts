// US2: вычисление в фоновом потоке (фича 004). US2 #2, #3 — unit: worker-channel.test.ts
import { expect, test, type Page } from '@playwright/test';
import { addNode, closeSidebar, connect, openSidebar, setInput, valueOf } from './helpers';

const indicator = (page: Page) => page.getByRole('button', { name: /^Engine: / });

async function selectRow(page: Page, title: string) {
  const section = (await openSidebar(page)).getByRole('region', { name: 'Engine' });
  await section.getByRole('listitem').filter({ hasText: title }).getByRole('button').click();
  return section;
}

test('US2 #1, #4: выбор «This browser · Worker» — те же значения; возврат в окно без потери', async ({
  page,
}) => {
  await page.goto('/');
  const a = await addNode(page, 'Number', 80, 60);
  const b = await addNode(page, 'Number', 80, 260);
  const sum = await addNode(page, 'Add', 420, 140);
  await setInput(page, a, 'value', '2');
  await setInput(page, b, 'value', '3');
  await connect(page, a, 'value', sum, 'a');
  await connect(page, b, 'value', sum, 'b');
  await expect(await valueOf(page, sum, 'out', 'result')).toHaveText('5');

  const section = await selectRow(page, 'This browser');
  await expect(indicator(page)).toHaveText('● Worker');
  await expect(
    section.getByRole('listitem').filter({ hasText: 'This browser' }).getByRole('button'),
  ).toHaveAttribute('aria-current', 'true');
  await closeSidebar(page);
  await expect(await valueOf(page, sum, 'out', 'result')).toHaveText('5');
  await setInput(page, a, 'value', '10');
  await expect(await valueOf(page, sum, 'out', 'result')).toHaveText('13');

  await selectRow(page, 'This tab');
  await expect(indicator(page)).toHaveText('● Local');
  await closeSidebar(page);
  await expect(await valueOf(page, sum, 'out', 'result')).toHaveText('13');
});

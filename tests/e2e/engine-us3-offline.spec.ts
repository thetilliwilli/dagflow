// US3: работа без связи с сервером и восстановление (фича 004). US3 #7 — компонентный тест
// stale-values.test.tsx и e2e US4 (перезагрузка с сохранённой целью)
import type { Page } from '@playwright/test';
import {
  addNode,
  closeSidebar,
  connect,
  openSidebar,
  selectNode,
  setInput,
  tabBar,
  valueOf,
} from './helpers';
import { expect, test } from './engine-server';

const indicator = (page: Page) => page.getByRole('button', { name: /^Engine: / });

async function connectTo(page: Page, address: string) {
  const sidebar = await openSidebar(page);
  const section = sidebar.getByRole('region', { name: 'Engine' });
  await section.getByRole('textbox', { name: 'Server address, e.g. localhost:8080' }).fill(address);
  await section.getByRole('button', { name: 'Connect' }).click();
  await expect(indicator(page)).toHaveText(/● Server/);
  await closeSidebar(page);
}

test('US3 #1–#6, SC-003, SC-004: обрыв, правки без связи, восстановление', async ({
  page,
  engineServer,
}) => {
  await page.goto('/');
  const n = await addNode(page, 'Number', 80, 100);
  const show = await addNode(page, 'Show', 460, 100);
  await setInput(page, n, 'value', '2');
  await connect(page, n, 'value', show, 'value');
  await connectTo(page, engineServer.address);
  await expect(await valueOf(page, show, 'in', 'value')).toHaveText('2');

  // #1: сервер остановлен → «Offline» не позже чем через 2 с, значения приглушены
  const stoppedAt = Date.now();
  await engineServer.stop();
  await expect(indicator(page)).toHaveText(/◌ Offline — retrying in \d+ s/, { timeout: 2_000 });
  expect(Date.now() - stoppedAt).toBeLessThan(2_000);
  await expect(page.getByRole('button', { name: 'Retry now' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use local engine' })).toBeVisible();
  await selectNode(show);
  await expect(page.getByText('Last known value — engine offline')).toBeVisible();
  await expect(show.locator('.flow-node')).toHaveClass(/is-stale/);

  // #2, SC-004: без связи работают правка значений, палитра, связи, отмена, вкладки, сохранение
  await setInput(page, n, 'value', '9');
  const extra = await addNode(page, 'Number', 80, 320); // палитра
  const show2 = await addNode(page, 'Show', 460, 320);
  await setInput(page, extra, 'value', '5');
  await connect(page, extra, 'value', show2, 'value'); // проверка связи — локальным engine
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  const nodes = page.locator('.react-flow__node');
  await addNode(page, 'Number', 820, 320);
  await expect(nodes).toHaveCount(5);
  await page.keyboard.press('Control+z'); // отмена
  await expect(nodes).toHaveCount(4);
  await (await openSidebar(page)).getByRole('button', { name: 'Create workflow' }).click();
  await expect(tabBar(page).getByRole('tab')).toHaveCount(2);
  await tabBar(page).getByRole('tab').first().click(); // переключение вкладок
  await expect(nodes).toHaveCount(4);

  // #4: «Retry now» — попытка сразу (сервер ещё лежит — снова Offline)
  await page.getByRole('button', { name: 'Retry now' }).click();
  await expect(indicator(page)).toHaveText(/◌ Offline/);

  // #5, #6, SC-003: сервер снова запущен (свежий) → значения с правками не позже чем через 15 с
  const restartedAt = Date.now();
  await engineServer.start();
  await expect(indicator(page)).toHaveText(/● Server/, { timeout: 15_000 });
  await expect(await valueOf(page, show, 'in', 'value')).toHaveText('9');
  expect(Date.now() - restartedAt).toBeLessThan(15_000);
  await expect(show.locator('.flow-node')).not.toHaveClass(/is-stale/);
  // Ни одна правка без связи не потерялась: связь, созданная без связи, посчитана сервером
  await expect(await valueOf(page, show2, 'in', 'value')).toHaveText('5');

  // Сохранение работало без связи: после перезагрузки граф на месте и считается на сервере
  await page.waitForTimeout(1_000);
  await page.reload();
  await expect(indicator(page)).toHaveText(/● Server/);
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
});

test('US3 #8: «Use local engine» без связи → вычисление в окне, сервер остаётся в списке', async ({
  page,
  engineServer,
}) => {
  await page.goto('/');
  const n = await addNode(page, 'Number', 80, 100);
  const show = await addNode(page, 'Show', 460, 100);
  await connect(page, n, 'value', show, 'value');
  await connectTo(page, engineServer.address);
  await engineServer.stop();
  await expect(indicator(page)).toHaveText(/◌ Offline/);

  await page.getByRole('button', { name: 'Use local engine' }).click();
  await expect(indicator(page)).toHaveText('● Local');
  await setInput(page, n, 'value', '4');
  await expect(await valueOf(page, show, 'in', 'value')).toHaveText('4');
  const section = (await openSidebar(page)).getByRole('region', { name: 'Engine' });
  await expect(
    section.getByRole('listitem').filter({ hasText: engineServer.address }),
  ).toBeVisible();
  await expect(
    section.getByRole('listitem').filter({ hasText: 'This tab' }).getByRole('button'),
  ).toHaveAttribute('aria-current', 'true');
});

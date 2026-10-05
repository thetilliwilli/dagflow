// SC-002 / SC-003 на графе из 100 нодов. Отдельный проект Playwright `perf` (npm run test:perf).
// Замеры — внутри страницы (performance.now), чтобы не учитывать накладные расходы протокола.
import { expect, test } from '@playwright/test';

function chainExport() {
  const nodes = [{ id: 'src', type: 'builtin:number', name: 'Число', position: { x: 0, y: 0 }, values: { value: 1 } }];
  const edges = [];
  for (let i = 1; i <= 98; i++) {
    nodes.push({ id: `n${i}`, type: 'builtin:add', name: 'Сложить', position: { x: 260 * (i % 10), y: 160 * Math.floor(i / 10) }, values: { b: 1 } as never });
    edges.push({ id: `e${i}`, source: { node: i === 1 ? 'src' : `n${i - 1}`, port: i === 1 ? 'value' : 'result' }, target: { node: `n${i}`, port: 'a' } });
  }
  nodes.push({ id: 'show', type: 'builtin:show', name: 'Показать', position: { x: 0, y: 1700 }, values: {} as never });
  edges.push({ id: 'e99', source: { node: 'n98', port: 'result' }, target: { node: 'show', port: 'value' } });
  const workflow = { id: 'perf', name: 'Perf 100', createdAt: '', updatedAt: '', graph: { nodes, edges } };
  return JSON.stringify({ format: 'dagflow-export', version: 1, exportedAt: '', workflow, composites: [] });
}

test('SC-002/SC-003: граф из 100 нодов', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Загрузить из файла').setInputFiles({ name: 'perf.dagflow.json', mimeType: 'application/json', buffer: Buffer.from(chainExport()) });
  await expect(page.locator('.react-flow__node')).toHaveCount(100);
  const show = page.locator('.react-flow__node[data-id="show"] [data-testid="show-value"]');
  await expect(show).toHaveText('99');

  // SC-003: изменение входа доходит до последнего нода < 200 мс
  const propagation = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('.react-flow__node[data-id="src"] input[aria-label="value"]')!;
    const out = document.querySelector('.react-flow__node[data-id="show"] [data-testid="show-value"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const v = 10 + i;
      const t0 = performance.now();
      setValue.call(input, String(v));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise<void>((resolve) => {
        const check = () => (out.textContent === String(v + 98) ? resolve() : requestAnimationFrame(check));
        check();
      });
      runs.push(performance.now() - t0);
    }
    return runs.sort((a, b) => a - b)[2]!;
  });

  // SC-002: добавление нода отображается < 100 мс
  const addition = await page.evaluate(async () => {
    const item = [...document.querySelectorAll('.palette__item')].find((el) => el.querySelector('.palette__item-title')?.textContent === 'Число')!;
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const before = document.querySelectorAll('.react-flow__node').length;
      const t0 = performance.now();
      item.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await new Promise<void>((resolve) => {
        const check = () => (document.querySelectorAll('.react-flow__node').length > before ? resolve() : requestAnimationFrame(check));
        check();
      });
      runs.push(performance.now() - t0);
    }
    return runs.sort((a, b) => a - b)[2]!;
  });

  // SC-002: перемещение нода (стрелкой с клавиатуры) отображается < 100 мс
  await page.locator('.react-flow__node[data-id="n5"] .flow-node__name').click();
  const move = await page.evaluate(async () => {
    const node = document.querySelector<HTMLElement>('.react-flow__node[data-id="n5"]')!;
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const before = node.style.transform;
      const t0 = performance.now();
      node.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise<void>((resolve) => {
        const check = () => (node.style.transform !== before ? resolve() : requestAnimationFrame(check));
        check();
      });
      runs.push(performance.now() - t0);
    }
    return runs.sort((a, b) => a - b)[2]!;
  });

  console.log(`SC-003 распространение: ${propagation.toFixed(1)} мс; SC-002 добавление: ${addition.toFixed(1)} мс; перемещение: ${move.toFixed(1)} мс`);
  expect(propagation).toBeLessThan(200);
  expect(addition).toBeLessThan(100);
  expect(move).toBeLessThan(100);
});

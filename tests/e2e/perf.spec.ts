// SC-002 / SC-003 (фича 001, SC-008 фичи 002) и SC-005 (фича 002) на графе из 100 нодов.
// Отдельный проект Playwright `perf` (npm run test:perf). Замеры — внутри страницы
// (performance.now), чтобы не учитывать накладные расходы протокола.
import { expect, test, type Page } from '@playwright/test';
import { openSidebar, paletteItem, selectNode, setInput } from './helpers';

function chainExport() {
  const nodes = [
    {
      id: 'src',
      type: 'builtin:number',
      name: 'Number',
      position: { x: 0, y: 0 },
      values: { value: 1 },
    },
  ];
  const edges = [];
  for (let i = 1; i <= 98; i++) {
    nodes.push({
      id: `n${i}`,
      type: 'builtin:add',
      name: 'Add',
      position: { x: 260 * (i % 10), y: 160 * Math.floor(i / 10) },
      values: { b: 1 } as never,
    });
    edges.push({
      id: `e${i}`,
      source: { node: i === 1 ? 'src' : `n${i - 1}`, port: i === 1 ? 'value' : 'result' },
      target: { node: `n${i}`, port: 'a' },
    });
  }
  nodes.push({
    id: 'show',
    type: 'builtin:show',
    name: 'Show',
    position: { x: 0, y: 1700 },
    values: {} as never,
  });
  edges.push({
    id: 'e99',
    source: { node: 'n98', port: 'result' },
    target: { node: 'show', port: 'value' },
  });
  const workflow = {
    id: 'perf',
    name: 'Perf 100',
    createdAt: '',
    updatedAt: '',
    graph: { nodes, edges },
  };
  return JSON.stringify({
    format: 'dagflow-export',
    version: 1,
    exportedAt: '',
    workflow,
    composites: [],
  });
}

const median = (runs: number[]) => runs.sort((a, b) => a - b)[Math.floor(runs.length / 2)]!;
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const showValue = (page: Page) =>
  page.locator('.prop-grid li.prop-row[data-side="in"][data-port="value"] .value-view');

/** Время внутри страницы: от события `trigger` на документе до появления `selector`. */
async function armAppearance(page: Page, trigger: 'pointerdown' | 'pointermove', selector: string) {
  await page.evaluate(
    ([ev, sel]) => {
      const w = window as unknown as { __t: number[]; __done: Promise<number> };
      w.__t = [];
      document.addEventListener(ev, () => w.__t.push(performance.now()), { capture: true });
      w.__done = new Promise<number>((resolve) => {
        const obs = new MutationObserver(() => {
          if (!document.querySelector(sel)) return;
          obs.disconnect();
          const t1 = performance.now();
          // Последнее событие указателя до появления окна
          const t0 = w.__t.filter((t) => t <= t1).at(-1) ?? t1;
          resolve(t1 - t0);
        });
        obs.observe(document.body, { childList: true, subtree: true });
      });
    },
    [trigger, selector] as const,
  );
}
const appeared = (page: Page) =>
  page.evaluate(() => (window as unknown as { __done: Promise<number> }).__done);

test('SC-002/SC-003/SC-005: граф из 100 нодов', async ({ page }) => {
  await page.goto('/');
  await (
    await openSidebar(page)
  )
    .getByLabel('Import from file')
    .setInputFiles({
      name: 'perf.dagflow.json',
      mimeType: 'application/json',
      buffer: Buffer.from(chainExport()),
    });
  await page.getByRole('button', { name: 'Menu' }).click(); // закрыть левую панель
  await expect(page.locator('.react-flow__node')).toHaveCount(100);
  await page.locator('.react-flow__controls-fitview').click();

  // SC-003: изменение входа доходит до последнего нода < 200 мс. Значение «Числа» меняется
  // отменой/повтором, а окно свойств открыто на «Показать» — два окна свойств сразу не открыть.
  await setInput(page, node(page, 'src'), 'value', '10');
  await selectNode(node(page, 'show'));
  await expect(showValue(page)).toHaveText('108');
  const propagation = await page.evaluate(async () => {
    const out = () =>
      document.querySelector('.prop-grid li.prop-row[data-port="value"] .value-view')!.textContent;
    const runs: number[] = [];
    for (let i = 0; i < 6; i++) {
      const before = out();
      const t0 = performance.now();
      const redo = i % 2 === 1;
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: redo, bubbles: true }),
      );
      await new Promise<void>((resolve) => {
        const check = () => (out() !== before ? resolve() : requestAnimationFrame(check));
        check();
      });
      runs.push(performance.now() - t0);
    }
    return runs;
  });

  // SC-002: добавление нода щелчком по палитре отображается < 100 мс
  await paletteItem(page, 'Number');
  const addition = await page.evaluate(async () => {
    const item = [...document.querySelectorAll('.palette__item')].find(
      (el) => el.querySelector('.palette__item-title')?.textContent === 'Number',
    )!;
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const before = document.querySelectorAll('.react-flow__node').length;
      const t0 = performance.now();
      item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise<void>((resolve) => {
        const check = () =>
          document.querySelectorAll('.react-flow__node').length > before
            ? resolve()
            : requestAnimationFrame(check);
        check();
      });
      runs.push(performance.now() - t0);
    }
    return runs;
  });
  await page.keyboard.press('Space'); // закрыть палитру

  // SC-002: перемещение нода (стрелкой с клавиатуры) отображается < 100 мс
  await selectNode(node(page, 'n5'));
  const move = await page.evaluate(async () => {
    const n = document.querySelector<HTMLElement>('.react-flow__node[data-id="n5"]')!;
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const before = n.style.transform;
      const t0 = performance.now();
      n.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise<void>((resolve) => {
        const check = () =>
          n.style.transform !== before ? resolve() : requestAnimationFrame(check);
        check();
      });
      runs.push(performance.now() - t0);
    }
    return runs;
  });

  // SC-005: окно свойств появляется при выделении нода < 100 мс
  const gridRuns: number[] = [];
  for (const id of ['n10', 'n20', 'n30']) {
    await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('dialog', { name: 'Properties' })).toHaveCount(0);
    await armAppearance(page, 'pointerdown', '.prop-grid');
    await selectNode(node(page, id));
    gridRuns.push(await appeared(page));
  }

  // SC-005: временное окно появляется при наведении на нод во время связывания < 100 мс
  const peekRuns: number[] = [];
  for (const target of ['n12', 'n13', 'n14']) {
    await selectNode(node(page, 'n2'));
    const src = (await page
      .locator('.prop-grid li.prop-row[data-side="out"] .prop-name')
      .boundingBox())!;
    await page.mouse.move(src.x + 5, src.y + 5);
    await page.mouse.down();
    await page.mouse.move(src.x - 40, src.y, { steps: 3 });
    await armAppearance(page, 'pointermove', `[data-peek-node="${target}"]`);
    const t = (await node(page, target).locator('.flow-node__name').boundingBox())!;
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 4 });
    peekRuns.push(await appeared(page));
    await page.keyboard.press('Escape');
    await page.mouse.up();
  }

  const report = {
    'SC-003 распространение': median(propagation),
    'SC-002 добавление': median(addition),
    'SC-002 перемещение': median(move),
    'SC-005 окно свойств': median(gridRuns),
    'SC-005 временное окно': median(peekRuns),
  };
  console.log(
    Object.entries(report)
      .map(([k, v]) => `${k}: ${v.toFixed(1)} мс`)
      .join('; '),
  );
  expect(report['SC-003 распространение']).toBeLessThan(200);
  expect(report['SC-002 добавление']).toBeLessThan(100);
  expect(report['SC-002 перемещение']).toBeLessThan(100);
  expect(report['SC-005 окно свойств']).toBeLessThan(100);
  expect(report['SC-005 временное окно']).toBeLessThan(100);
});

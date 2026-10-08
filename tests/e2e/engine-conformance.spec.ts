// SC-001 в браузере (research R13): на собранном редакторе Local и Worker дают те же состояния нодов,
// что хост протокола в процессе теста. Запуск: npm run test:e2e:bundle (playwright.bundle.config.ts).
// Эталон unknown-and-cycle сюда не входит: импорт отклоняет неизвестные типы — его проверяют сервер и unit
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { formatCompact, type NodeState } from '@dagflow/engine';
import { createEngineHost, PROTOCOL_VERSION } from '@dagflow/protocol';
import { closeSidebar, openSidebar, selectNode } from './helpers';

const DIR = 'tests/conformance/fixtures';
const fixtures = readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && f !== 'unknown-and-cycle.json')
  .map((f) => ({
    name: f,
    path: join(DIR, f),
    data: JSON.parse(readFileSync(join(DIR, f), 'utf8')),
  }));

/** Эталон — хост протокола в процессе теста. */
function expected(data: {
  workflow: { graph: { nodes: Array<{ id: string; name: string }> } };
  composites: unknown[];
}): Record<string, NodeState> {
  const host = createEngineHost();
  const out = [
    { type: 'hello', protocol: PROTOCOL_VERSION, engine: 'bundle' },
    { type: 'library', composites: data.composites },
    { type: 'open', doc: 'doc', rev: 1, graph: data.workflow.graph },
  ].flatMap((m) => host.receive(JSON.stringify(m)));
  while (host.needsTick()) out.push(...host.tick());
  const states: Record<string, NodeState> = {};
  for (const m of out) if (m.type === 'states') Object.assign(states, m.states);
  return states;
}

const nodeByName = (page: Page, name: string) =>
  page
    .locator('.react-flow__node')
    .filter({ has: page.locator('.flow-node__name', { hasText: new RegExp(`^${name}$`) }) });

/** Сравнить каждый нод: статус, сообщение и выходы (как их показывает окно «Properties»). */
async function compare(page: Page, want: Record<string, NodeState>) {
  for (const [name, state] of Object.entries(want)) {
    const node = nodeByName(page, name);
    await expect(node.locator('.flow-node')).toHaveClass(new RegExp(`status-${state.status}`));
    if (state.status === 'error' || state.status === 'waiting' || state.status === 'blocked') {
      await expect(node.locator('.flow-node__problem')).toHaveText(state.message ?? '');
    }
    if (state.status !== 'ok') continue;
    await selectNode(node);
    for (const [port, value] of Object.entries(state.outputs)) {
      const row = page.locator(`.prop-grid li.prop-row[data-side="out"][data-port="${port}"]`);
      await expect(row.locator('.value-view__compact')).toHaveText(formatCompact(value));
    }
  }
}

async function selectTarget(page: Page, title: string, indicatorText: string) {
  const section = (await openSidebar(page)).getByRole('region', { name: 'Engine' });
  await section.getByRole('listitem').filter({ hasText: title }).getByRole('button').click();
  await expect(page.getByRole('button', { name: /^Engine: / })).toHaveText(indicatorText);
  await closeSidebar(page);
}

for (const { name, path, data } of fixtures) {
  test(`SC-001 ${name}: Local и Worker на собранном редакторе = хост протокола`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('./');
    await (await openSidebar(page)).getByLabel('Import from file').setInputFiles(path);
    await closeSidebar(page);
    const want = expected(data);

    await expect(page.getByRole('button', { name: /^Engine: / })).toHaveText('● Local');
    await compare(page, want);

    await selectTarget(page, 'This browser', '● Worker');
    await compare(page, want);
  });
}

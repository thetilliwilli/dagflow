// US6: несовместимая версия и ошибки обмена (фича 004) — с поддельными серверами (research R17)
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { addNode, closeSidebar, connect, openSidebar, setInput, valueOf } from './helpers';
import { expect, startFakeServer, test, type FakeKind } from './engine-server';

const indicator = (page: Page) => page.getByRole('button', { name: /^Engine: / });

async function connectTo(page: Page, address: string) {
  const s = (await openSidebar(page)).getByRole('region', { name: 'Engine' });
  await s.getByRole('textbox', { name: 'Server address, e.g. localhost:8080' }).fill(address);
  await s.getByRole('button', { name: 'Connect' }).click();
  return s;
}

/** Поддельный сервер на время теста. */
async function withFake(kind: FakeKind, run: (address: string) => Promise<void>, port?: number) {
  const fake = await startFakeServer(kind, port);
  try {
    await run(fake.address);
  } finally {
    await fake.close();
  }
}

test('US6 #1: другая версия протокола при ручном подключении → текст с версиями, прежняя цель', async ({
  page,
}) => {
  await page.goto('/');
  await withFake('other-protocol', async (address) => {
    const s = await connectTo(page, address);
    await expect(s.getByRole('alert')).toHaveText(
      'The server uses a different protocol version (server 2, editor 1). Update the server or the editor.',
    );
    await expect(indicator(page)).toHaveText('● Local');
  });
});

test('US6 #2: сохранённый сервер обновился до другого протокола → индикатор и «Use local engine», без повторов', async ({
  page,
  engineServer,
}) => {
  await page.goto('/');
  await connectTo(page, engineServer.address);
  await expect(indicator(page)).toHaveText(/● Server/);
  await page.waitForTimeout(500);
  await engineServer.stop();
  await withFake(
    'other-protocol',
    async () => {
      await page.reload();
      await expect(indicator(page)).toHaveText('Protocol version differs (server 2, editor 1)');
      await expect(page.getByRole('button', { name: 'Use local engine' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry now' })).toHaveCount(0);
      // Повторов нет: через несколько пауз состояние то же
      await page.waitForTimeout(2_000);
      await expect(indicator(page)).toHaveText('Protocol version differs (server 2, editor 1)');
      await page.getByRole('button', { name: 'Use local engine' }).click();
      await expect(indicator(page)).toHaveText('● Local');
    },
    engineServer.port,
  );
});

test('US6 #3: другая версия engine при той же версии протокола → подключение работает, видны обе', async ({
  page,
}) => {
  await page.goto('/');
  await withFake('other-engine', async (address) => {
    const s = await connectTo(page, address);
    await expect(indicator(page)).toHaveText(`● Server · ${address} · engine 0.0.9 (editor 0.1.0)`);
    await expect(s.getByText('engine 0.0.9 (editor 0.1.0)')).toBeVisible();
  });
});

test('US6 #4: сервер не знает тип нода → у него ошибка неизвестного типа, остальные считаются', async ({
  page,
}) => {
  await page.goto('/');
  const n = await addNode(page, 'Number', 80, 60);
  const cat = await addNode(page, 'Concatenate', 80, 260);
  await setInput(page, n, 'value', '5');
  await withFake('unknown-node', async (address) => {
    await connectTo(page, address);
    await expect(indicator(page)).toHaveText(/● Server/);
    await closeSidebar(page);
    await expect(cat.locator('.flow-node__problem')).toHaveText(
      'Unknown node type: builtin:concat.',
    );
    await expect(await valueOf(page, n, 'out', 'value')).toHaveText('5');
  });
});

test('US6 #5: вкладка больше 8 МБ → сообщение о лимите, ноды приглушены; после правки — снова считается', async ({
  page,
  engineServer,
}) => {
  // Workflow с огромным текстом — через загрузку файла
  const dir = mkdtempSync(join(tmpdir(), 'dagflow-big-'));
  const file = join(dir, 'big.dagflow.json');
  const base = JSON.parse(readFileSync('tests/conformance/fixtures/waiting.json', 'utf8')) as {
    workflow: { name: string; graph: { nodes: Array<Record<string, unknown>> } };
  };
  base.workflow.name = 'Big';
  base.workflow.graph.nodes.push({
    id: 'big',
    type: 'builtin:text',
    name: 'Big',
    position: { x: 0, y: 500 },
    values: { value: 'x'.repeat(8 * 1024 * 1024 + 10) },
  });
  writeFileSync(file, JSON.stringify(base));

  await page.goto('/');
  await connectTo(page, engineServer.address);
  await expect(indicator(page)).toHaveText(/● Server/);
  await (await openSidebar(page)).getByLabel('Import from file').setInputFiles(file);
  await closeSidebar(page);
  const banner = page.getByRole('alert').filter({ hasText: 'too large' });
  await expect(banner).toHaveText('This workflow is too large for the server (limit: 8 MB).');
  const big = page.locator('.react-flow__node').filter({ hasText: 'Big' });
  await expect(big.locator('.flow-node')).toHaveClass(/is-stale/);

  await setInput(page, big, 'value', 'small');
  await expect(banner).toHaveCount(0);
  await expect(big.locator('.flow-node')).not.toHaveClass(/is-stale/);
  await expect(await valueOf(page, big, 'out', 'value')).toHaveText('small');
});

test('US6 #6: цель не смогла обработать вкладку → уведомление и один повтор', async ({ page }) => {
  await page.goto('/');
  await addNode(page, 'Number', 80, 60);
  await withFake('failing', async (address) => {
    await connectTo(page, address);
    await expect(
      page.getByText('The engine could not process the workflow. Retrying.').first(),
    ).toBeVisible();
    // Один повтор на граф: уведомлений два (исходный сбой и повтор), дальше — тишина
    await page.waitForTimeout(500);
    await expect(
      page.getByText('The engine could not process the workflow. Retrying.'),
    ).toHaveCount(2);
  });
});

test('US6 #7: сервер забыл вкладку → она передаётся заново без уведомления, значения пересчитаны', async ({
  page,
}) => {
  await page.goto('/');
  const n = await addNode(page, 'Number', 80, 60);
  const show = await addNode(page, 'Show', 460, 60);
  await connect(page, n, 'value', show, 'value');
  await withFake('forgetful', async (address) => {
    await connectTo(page, address);
    await expect(indicator(page)).toHaveText(/● Server/);
    await closeSidebar(page);
    await setInput(page, n, 'value', '8');
    await expect(await valueOf(page, show, 'in', 'value')).toHaveText('8');
    await expect(
      page.getByText('The engine could not process the workflow. Retrying.'),
    ).toHaveCount(0);
  });
});

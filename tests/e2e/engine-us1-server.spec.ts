// US1: вычисление на своём сервере (фича 004). US1 #4, #5 — также unit: протокол (host-client, client)
import type { Page } from '@playwright/test';
import { addNode, closeSidebar, connect, openSidebar, setInput, valueOf } from './helpers';
import { expect, startFakeServer, test } from './engine-server';

async function connectTo(page: Page, address: string) {
  const sidebar = await openSidebar(page);
  const section = sidebar.getByRole('region', { name: 'Engine' });
  await section.getByRole('textbox', { name: 'Server address, e.g. localhost:8080' }).fill(address);
  await section.getByRole('button', { name: 'Connect' }).click();
  return section;
}

const indicator = (page: Page) => page.getByRole('button', { name: /^Engine: / });

test('US1 #1, #2, SC-005: подключение по короткому адресу, «2 + 3 → Show» считает сервер', async ({
  page,
  engineServer,
}) => {
  await page.goto('/');
  const n1 = await addNode(page, 'Number', 80, 60);
  const n2 = await addNode(page, 'Number', 80, 260);
  const sum = await addNode(page, 'Add', 420, 140);
  const show = await addNode(page, 'Show', 760, 140);
  await setInput(page, n1, 'value', '2');
  await setInput(page, n2, 'value', '3');
  await connect(page, n1, 'value', sum, 'a');
  await connect(page, n2, 'value', sum, 'b');
  await connect(page, sum, 'result', show, 'value');

  const started = Date.now();
  const section = await connectTo(page, engineServer.address);
  await expect(indicator(page)).toHaveText(`● Server · ${engineServer.address} · engine 0.1.0`);
  expect(Date.now() - started).toBeLessThan(30_000);
  const row = section.getByRole('listitem').filter({ hasText: engineServer.address });
  await expect(row).toContainText('Server');
  await expect(row.getByRole('button')).toHaveAttribute('aria-current', 'true');
  // Сервер получил вкладку и считает её
  await expect.poll(() => engineServer.output()).toContain('Connected: ');
  await closeSidebar(page);

  await expect(await valueOf(page, show, 'in', 'value')).toHaveText('5');
  await setInput(page, n1, 'value', '10');
  await expect(await valueOf(page, show, 'in', 'value')).toHaveText('13');
});

test('US1 #3: ошибка нода на сервере — тот же текст, что в окне', async ({
  page,
  engineServer,
}) => {
  await page.goto('/');
  const div = await addNode(page, 'Divide', 200, 120);
  await setInput(page, div, 'a', '1');
  await setInput(page, div, 'b', '0');
  const problem = div.locator('.flow-node__problem');
  await expect(problem).not.toBeEmpty();
  const localText = await problem.textContent();

  await connectTo(page, engineServer.address);
  await expect(indicator(page)).toHaveText(/● Server/);
  await closeSidebar(page);
  await setInput(page, div, 'a', '2');
  await expect(problem).toHaveText(localText!);
});

test('US1 #6, #7: по адресу ничего нет → ошибка у поля, вычисление на прежней цели; порт не подставляется', async ({
  page,
}) => {
  await page.goto('/');
  const section = await connectTo(page, 'localhost:1');
  await expect(section.getByRole('alert')).toHaveText(
    'Could not connect to localhost:1. Check that the server is running and the address is correct.',
  );
  await expect(indicator(page)).toHaveText('● Local');

  await connectTo(page, 'localhost');
  await expect(section.getByRole('alert')).toHaveText(
    'Could not connect to localhost. Check that the server is running and the address is correct.',
  );
});

for (const kind of ['not-engine', 'silent'] as const) {
  test(`US1 #8: по адресу другой сервис (${kind}) → ошибка, прежняя цель`, async ({ page }) => {
    const fake = await startFakeServer(kind);
    try {
      await page.goto('/');
      const section = await connectTo(page, fake.address);
      await expect(section.getByRole('alert')).toHaveText(
        `Could not connect to ${fake.address}. Check that the server is running and the address is correct.`,
        { timeout: 10_000 },
      );
      await expect(indicator(page)).toHaveText('● Local');
    } finally {
      await fake.close();
    }
  });
}

/** «tx 12.4 KB / rx 3.1 MB» → байты (приблизительно — для сравнения «больше/меньше»). */
async function traffic(page: Page): Promise<{ tx: number; rx: number }> {
  const text = (await page.getByTestId('engine-traffic').textContent()) ?? '';
  const unit: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
  const m = /^tx ([\d.]+) (B|KB|MB|GB) \/ rx ([\d.]+) (B|KB|MB|GB)$/.exec(text);
  if (!m) throw new Error(`unexpected traffic text: ${text}`);
  return { tx: Number(m[1]) * unit[m[2]!]!, rx: Number(m[3]) * unit[m[4]!]! };
}

test('US1 #9, FR-013a: справа от индикатора — объём обмена tx/rx; растёт при правке, при смене цели — с нуля', async ({
  page,
  engineServer,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('engine-traffic')).toHaveText(
    /^tx [\d.]+ (B|KB|MB) \/ rx [\d.]+ (B|KB|MB)$/,
  );
  const n = await addNode(page, 'Number', 80, 60);
  for (let i = 0; i < 3; i++) await addNode(page, 'Number', 80 + 200 * i, 260);
  await connectTo(page, engineServer.address);
  await expect(indicator(page)).toHaveText(/● Server/);
  await closeSidebar(page);
  const before = await traffic(page);
  expect(before.tx).toBeGreaterThan(0);
  expect(before.rx).toBeGreaterThan(0);

  await setInput(page, n, 'value', '42');
  await expect.poll(async () => (await traffic(page)).tx).toBeGreaterThan(before.tx);
  await expect.poll(async () => (await traffic(page)).rx).toBeGreaterThan(before.rx);
  const onServer = await traffic(page);

  // Смена цели — счёт с нуля: на Local пока ушёл только начальный снимок
  const section = (await openSidebar(page)).getByRole('region', { name: 'Engine' });
  await section.getByRole('listitem').filter({ hasText: 'This tab' }).getByRole('button').click();
  await expect(indicator(page)).toHaveText('● Local');
  expect((await traffic(page)).tx).toBeLessThan(onServer.tx);
});

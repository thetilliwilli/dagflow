// US4: список целей и запоминание выбора (фича 004); US3 #7, #8 — после перезагрузки.
// Разные адреса одного сервера — пути: сервер принимает WebSocket на любом пути
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { openSidebar } from './helpers';
import { expect, test } from './engine-server';

const indicator = (page: Page) => page.getByRole('button', { name: /^Engine: / });

async function section(page: Page) {
  return (await openSidebar(page)).getByRole('region', { name: 'Engine' });
}

async function connectTo(page: Page, address: string) {
  const s = await section(page);
  await s.getByRole('textbox', { name: 'Server address, e.g. localhost:8080' }).fill(address);
  await s.getByRole('button', { name: 'Connect' }).click();
  await expect(indicator(page)).toHaveText(`● Server · ${address} · engine 0.1.0`);
}

/** Строки серверов в списке (после двух локальных). */
async function servers(page: Page) {
  const rows = (await section(page)).getByRole('listitem');
  const texts = await rows.locator('.engine-section__title').allTextContents();
  return texts.slice(2);
}

/** Автосохранение настроек — асинхронная запись в IndexedDB: дать ей завершиться. */
const reload = async (page: Page) => {
  await page.waitForTimeout(500);
  await page.reload();
};

test('US4 #1, #7: при первом запуске — «This tab · Local» и «This browser · Worker»; индикатор открывает раздел', async ({
  page,
}) => {
  await page.goto('/');
  await expect(indicator(page)).toHaveText('● Local');
  await indicator(page).click();
  const s = page.getByRole('region', { name: 'Engine' });
  await expect(s).toBeVisible();
  await expect(s.getByRole('listitem')).toHaveText(['This tabLocal', 'This browserWorker']);
});

test('US4 #2–#6: серверы в порядке добавления, до 5, «×», щелчок по строке, перезагрузка', async ({
  page,
  engineServer,
}) => {
  await page.goto('/');
  const at = (n: number) => `${engineServer.address}/${n}`;
  for (let n = 1; n <= 6; n++) await connectTo(page, at(n));
  // #2, #3: новый — последним и выбран; шестой вытеснил добавленный раньше всех
  expect(await servers(page)).toEqual([at(2), at(3), at(4), at(5), at(6)]);

  // #5: «×» у невыбранного; у выбранного и у локальных строк его нет
  const s = await section(page);
  await expect(s.getByRole('button', { name: `Remove ${at(6)} from the list` })).toHaveCount(0);
  await s.getByRole('button', { name: `Remove ${at(2)} from the list` }).click();
  expect(await servers(page)).toEqual([at(3), at(4), at(5), at(6)]);

  // #4: щелчок по строке сервера — пробное подключение, строка остаётся на месте
  await s
    .getByRole('listitem')
    .filter({ hasText: at(4) })
    .getByRole('button')
    .first()
    .click();
  await expect(indicator(page)).toHaveText(`● Server · ${at(4)} · engine 0.1.0`);
  expect(await servers(page)).toEqual([at(3), at(4), at(5), at(6)]);
  // Повторный «Connect» к записанному адресу тоже не двигает строку
  await connectTo(page, at(3));
  expect(await servers(page)).toEqual([at(3), at(4), at(5), at(6)]);

  // #6: после перезагрузки — та же цель и тот же список
  await reload(page);
  await expect(indicator(page)).toHaveText(`● Server · ${at(3)} · engine 0.1.0`);
  expect(await servers(page)).toEqual([at(3), at(4), at(5), at(6)]);
});

test('US4 #8: пустой или недопустимый адрес → текст у поля, подключения нет', async ({ page }) => {
  await page.goto('/');
  const s = await section(page);
  const field = s.getByRole('textbox', { name: 'Server address, e.g. localhost:8080' });
  for (const value of ['', 'user@host:1']) {
    await field.fill(value);
    await s.getByRole('button', { name: 'Connect' }).click();
    await expect(s.getByRole('alert')).toHaveText(
      'Enter a server address, for example localhost:8080.',
    );
  }
  await expect(indicator(page)).toHaveText('● Local');
});

test('US4 #9: в выгруженном файле нет сведений о цели вычисления', async ({
  page,
  engineServer,
}) => {
  await page.goto('/');
  await connectTo(page, engineServer.address);
  const s = await openSidebar(page);
  const download = page.waitForEvent('download');
  await s.getByRole('button', { name: 'Export to file' }).click();
  const text = readFileSync((await (await download).path())!, 'utf8');
  expect(text).not.toContain(String(engineServer.port));
  expect(text).not.toMatch(/"(target|recent|engine)"/);
});

test('US4 #10: два окна — смена цели в одном не меняет другое; после перезагрузки выбран сервер', async ({
  page,
  context,
  engineServer,
}) => {
  await page.goto('/');
  const second = await context.newPage();
  await second.goto('/');
  await expect(indicator(second)).toHaveText('● Local');

  await connectTo(page, engineServer.address);
  await expect(indicator(second)).toHaveText('● Local');
  expect(await servers(second)).toEqual([]);

  await reload(second);
  await expect(indicator(second)).toHaveText(`● Server · ${engineServer.address} · engine 0.1.0`);
});

test('US3 #7, #8: сохранённый сервер недоступен при загрузке → «Offline» и «Use local engine»; после — Local', async ({
  page,
  engineServer,
}) => {
  await page.goto('/');
  await connectTo(page, engineServer.address);
  await engineServer.stop();
  await reload(page);
  await expect(indicator(page)).toHaveText(/◌ Offline — retrying in \d+ s/);
  await page.getByRole('button', { name: 'Use local engine' }).click();
  await expect(indicator(page)).toHaveText('● Local');
  await reload(page);
  await expect(indicator(page)).toHaveText('● Local');
  expect(await servers(page)).toEqual([engineServer.address]);
});

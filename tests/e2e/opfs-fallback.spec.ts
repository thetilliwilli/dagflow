// Риск R7: браузер без FileSystemFileHandle.createWritable (как старые Safari) — запись через воркер
import { expect, test } from '@playwright/test';
import { addNode } from './helpers';

test('OPFS без createWritable: автосохранение через Web Worker работает', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
    delete (FileSystemFileHandle.prototype as unknown as Record<string, unknown>).createWritable;
  });
  await page.goto('/');
  expect(await page.evaluate(() => 'createWritable' in FileSystemFileHandle.prototype)).toBe(false);
  const n = await addNode(page, 'Число', 60, 60);
  await n.getByLabel('value').fill('777');
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.locator('.react-flow__node').getByLabel('value')).toHaveValue('777');
});

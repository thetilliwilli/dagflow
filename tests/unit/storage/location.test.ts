import { describe, expect, it } from 'vitest';
import { browserStorageHandle, detectLocation, pickFolder, restoreAccess } from '../../../src/storage/location';
import { FakeDirectory } from './fake-directory';
import { fakeEnv } from './env';

describe('определение хранилища', () => {
  it('API выбора папок нет → браузер (FR-028b)', async () => {
    const { env, opfs } = fakeEnv({ picker: false });
    const d = await detectLocation(env);
    expect(d.location).toEqual({ kind: 'browser' });
    expect(d.handle).toBe(await opfs.getDirectoryHandle('dagflow'));
  });

  it('папка ещё не выбиралась → браузер', async () => {
    const { env } = fakeEnv();
    expect((await detectLocation(env)).location).toEqual({ kind: 'browser' });
  });

  it('сохранённая папка с доступом granted → folder', async () => {
    const folder = new FakeDirectory('my-flows');
    const { env } = fakeEnv({ folder, saved: folder });
    const d = await detectLocation(env);
    expect(d.location).toEqual({ kind: 'folder', name: 'my-flows' });
    expect(d.handle).toBe(folder);
  });

  it('prompt → folder-pending, ни одного обращения к содержимому папки (FR-028d)', async () => {
    const folder = new FakeDirectory('my-flows');
    folder.permission = 'prompt';
    const { env } = fakeEnv({ folder, saved: folder });
    const d = await detectLocation(env);
    expect(d.location).toEqual({ kind: 'folder-pending', name: 'my-flows' });
    expect(folder.accessCount).toBe(0);
  });

  it('restoreAccess возвращает true только при granted', async () => {
    const folder = new FakeDirectory('my-flows');
    folder.permission = 'denied';
    expect(await restoreAccess(folder.asHandle())).toBe(false);
    folder.permission = 'granted';
    expect(await restoreAccess(folder.asHandle())).toBe(true);
  });

  it('выбор папки сохраняет дескриптор; отказ в диалоге → null', async () => {
    const f = fakeEnv();
    const h = await pickFolder(f.env);
    expect(h).toBe(f.folder);
    expect(f.savedHandle()).toBe(f.folder);
    f.cancelPicker();
    expect(await pickFolder(f.env)).toBeNull();
  });

  it('хранилище браузера — подпапка dagflow в OPFS', async () => {
    const { env, opfs } = fakeEnv();
    await browserStorageHandle(env);
    expect([...opfs.entries.keys()]).toEqual(['dagflow']);
  });
});

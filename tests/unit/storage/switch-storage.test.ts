import { describe, expect, it } from 'vitest';
import type { Workflow } from '../../../src/engine';
import { toJsonText, workflowToFile, workspaceToFile } from '../../../src/model/serialize';
import { createPersistence } from '../../../src/store/persistence';
import { createAppStore, type AppState } from '../../../src/store/store';
import { sampleWorkflow } from '../model/fixtures';
import { FakeDirectory } from './fake-directory';
import { fakeEnv } from './env';

function setup(opts: Parameters<typeof fakeEnv>[0] = {}) {
  let seq = 0;
  const app = createAppStore({ newId: () => `id${++seq}`, now: () => '2026-10-05T00:00:00.000Z' });
  const f = fakeEnv(opts);
  const p = createPersistence(app, f.env, { events: new EventTarget(), autosaveDelay: 10_000 });
  const state = () => app.store.getState();
  return { app, p, state, ...f };
}

function wf(id: string, name: string): Workflow {
  return { ...sampleWorkflow(id), name };
}

function put(dir: FakeDirectory, workflows: Workflow[]) {
  for (const w of workflows)
    dir.put(`workflows/${w.id}.workflow.json`, toJsonText(workflowToFile(w)));
  dir.put(
    'workspace.json',
    toJsonText(
      workspaceToFile({ workflowOrder: workflows.map((w) => w.id), tabs: [], activeTabId: null }),
    ),
  );
}

describe('старт', () => {
  it('без сохранённой папки — данные из хранилища браузера', async () => {
    const { p, state, opfs } = setup();
    const dagflow = await opfs.getDirectoryHandle('dagflow', { create: true });
    put(dagflow, [wf('A', 'Из браузера')]);
    await p.start();
    expect(state().storageLocation).toEqual({ kind: 'browser' });
    expect(state().workflowOrder).toEqual(['A']);
    expect(state().workflows.A!.name).toBe('Из браузера');
  });

  it('первый запуск: пустое хранилище — workflow по умолчанию сохраняется', async () => {
    const { p, state, opfs } = setup();
    await p.start();
    await p.flush();
    expect(state().workflowOrder).toHaveLength(1);
    const dagflow = await opfs.getDirectoryHandle('dagflow');
    expect((dagflow as unknown as FakeDirectory).paths()).toContain('workspace.json');
  });

  it('folder-pending: данные не загружаются до восстановления доступа; затем загружаются (FR-028d)', async () => {
    const folder = new FakeDirectory('my-flows');
    put(folder, [wf('F', 'Из папки')]);
    folder.permission = 'prompt';
    folder.accessCount = 0;
    const { p, state } = setup({ folder, saved: folder });
    await p.start();
    expect(state().storageLocation).toEqual({ kind: 'folder-pending', name: 'my-flows' });
    expect(folder.accessCount).toBe(0);
    folder.permission = 'granted';
    await p.restoreAccess();
    expect(state().storageLocation).toEqual({ kind: 'folder', name: 'my-flows' });
    expect(state().workflows.F!.name).toBe('Из папки');
  });

  it('из folder-pending явный выбор «Работать в браузере» → браузер, папка не тронута', async () => {
    const folder = new FakeDirectory('my-flows');
    put(folder, [wf('F', 'Из папки')]);
    folder.permission = 'prompt';
    folder.accessCount = 0;
    const { p, state } = setup({ folder, saved: folder });
    await p.start();
    await p.useBrowser();
    await p.flush();
    expect(state().storageLocation).toEqual({ kind: 'browser' });
    expect(folder.accessCount).toBe(0);
  });
});

describe('смена хранилища (FR-028c)', () => {
  it('пустая папка → по подтверждению все данные скопированы', async () => {
    const { p, state, folder } = setup();
    await p.start();
    const id = state().workflowOrder[0]!;
    await p.chooseFolder();
    expect(state().storagePrompt).toEqual({ kind: 'copy-to-empty', folderName: 'my-flows' });
    await p.confirmPrompt();
    expect(state().storageLocation).toEqual({ kind: 'folder', name: 'my-flows' });
    expect(state().storagePrompt).toBeNull();
    expect(folder.paths()).toEqual([`workflows/${id}.workflow.json`, 'workspace.json']);
  });

  it('отказ в диалоге выбора папки → хранилище не меняется', async () => {
    const f = setup();
    await f.p.start();
    f.cancelPicker();
    await f.p.chooseFolder();
    expect(f.state().storageLocation).toEqual({ kind: 'browser' });
    expect(f.state().storagePrompt).toBeNull();
  });

  it('папка с данными: загружены данные папки, предложены отсутствующие и отличающиеся; файлы папки не перезаписаны', async () => {
    const folder = new FakeDirectory('my-flows');
    put(folder, [wf('A', 'Общий'), wf('C', 'Только в папке')]);
    const { p, state, app } = setup({ folder });
    await p.start();
    app.store.setState((d: AppState) => {
      d.workflows = { A: wf('A', 'Общий изменённый'), B: wf('B', 'Только в браузере') };
      d.workflowOrder = ['A', 'B'];
      d.tabs = [];
      d.activeTabId = null;
    });
    await p.chooseFolder();
    expect(state().storageLocation).toEqual({ kind: 'folder', name: 'my-flows' });
    expect(state().workflowOrder).toEqual(['A', 'C']);
    expect(state().workflows.A!.name).toBe('Общий');
    expect(state().storagePrompt).toMatchObject({
      kind: 'add-from-browser',
      folderName: 'my-flows',
    });
    const prompt = state().storagePrompt as { add: Workflow[]; copies: Workflow[] };
    expect(prompt.add.map((w) => w.id)).toEqual(['B']);
    expect(prompt.copies.map((w) => w.name)).toEqual(['Общий изменённый']);

    const writesA = folder.file('workflows/A.workflow.json')!.writes;
    await p.confirmPrompt();
    await p.flush();
    expect(state().workflowOrder.slice(0, 3)).toEqual(['A', 'C', 'B']);
    expect(state().workflowOrder).toHaveLength(4);
    const copyId = state().workflowOrder[3]!;
    expect(copyId).not.toBe('A');
    expect(state().workflows[copyId]!.name).toBe('Общий изменённый (from browser)');
    expect(folder.file('workflows/A.workflow.json')!.writes).toBe(writesA);
    expect(folder.file('workflows/C.workflow.json')!.writes).toBe(0);
    expect(folder.file('workflows/B.workflow.json')).toBeDefined();
    expect(folder.file(`workflows/${copyId}.workflow.json`)).toBeDefined();
  });

  it('одинаковый workflow в папке и браузере не предлагается', async () => {
    const folder = new FakeDirectory('my-flows');
    put(folder, [wf('A', 'Общий')]);
    const { p, state, app } = setup({ folder });
    await p.start();
    app.store.setState((d: AppState) => {
      d.workflows = { A: wf('A', 'Общий') };
      d.workflowOrder = ['A'];
      d.tabs = [];
      d.activeTabId = null;
    });
    await p.chooseFolder();
    expect(state().storagePrompt).toBeNull();
  });
});

describe('сбой папки во время работы', () => {
  it('переход в браузер с уведомлением без потери данных', async () => {
    const folder = new FakeDirectory('my-flows');
    const { p, state, app, opfs } = setup({ folder, saved: folder });
    await p.start();
    const id = state().workflowOrder[0]!;
    folder.failWith = new DOMException('gone', 'NotFoundError');
    app.store.setState((d: AppState) => {
      d.workflows[id]!.name = 'Важная работа';
    });
    await p.flush();
    expect(state().storageLocation).toEqual({ kind: 'browser' });
    expect(state().notifications.map((n) => n.kind)).toContain('warning');
    const dagflow = (await opfs.getDirectoryHandle('dagflow')) as unknown as FakeDirectory;
    expect(dagflow.file(`workflows/${id}.workflow.json`)!.content).toContain('Важная работа');
  });
});

describe('ошибки хранилища видны пользователю (Constitution IV, FR-032)', () => {
  it('сбой старта (OPFS недоступен): работа без сохранения, понятное сообщение', async () => {
    const f = setup({ picker: false });
    f.env.getOpfsRoot = async () => {
      throw new DOMException('Security error', 'SecurityError');
    };
    await f.p.start();
    expect(f.state().storageLocation).toMatchObject({ kind: 'none' });
    expect(f.state().notifications.at(-1)).toMatchObject({ kind: 'error' });
    expect(f.state().notifications.at(-1)!.text).toMatch(
      /^Saving unavailable: the browser denied access to storage \(/,
    );
    expect(f.state().workflowOrder).toHaveLength(1); // редактор работает
  });

  it('ошибка диалога выбора папки (не отказ) — уведомление, хранилище не меняется', async () => {
    const f = setup();
    await f.p.start();
    f.env.showDirectoryPicker = async () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    await f.p.chooseFolder();
    expect(f.state().storageLocation).toEqual({ kind: 'browser' });
    expect(f.state().notifications.at(-1)).toMatchObject({ kind: 'error' });
  });

  it('отказ в доступе на экране восстановления — сообщение «Доступ не предоставлен»', async () => {
    const folder = new FakeDirectory('my-flows');
    folder.permission = 'prompt';
    const f = setup({ folder, saved: folder });
    await f.p.start();
    folder.permission = 'denied';
    await f.p.restoreAccess();
    expect(f.state().storageLocation).toEqual({ kind: 'folder-pending', name: 'my-flows' });
    expect(f.state().notifications.at(-1)!.text).toMatch(
      /^Access not granted: the browser did not allow working with folder “/,
    );
  });

  it('сбой при переносе в папку — уведомление, данные остаются в прежнем хранилище', async () => {
    const f = setup();
    await f.p.start();
    await f.p.chooseFolder();
    f.folder.failWith = new DOMException('gone', 'NotFoundError');
    await f.p.confirmPrompt();
    expect(f.state().storageLocation).toEqual({ kind: 'browser' });
    expect(f.state().notifications.at(-1)).toMatchObject({ kind: 'error' });
  });
});

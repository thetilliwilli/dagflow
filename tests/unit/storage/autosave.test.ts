import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosave, type AutosaveTarget } from '../../../src/storage/autosave';
import { createAppStore, type AppState } from '../../../src/store/store';
import type { CompositeDef, Workflow, Workspace } from '../../../src/engine';

function fakeTarget() {
  const t = {
    saveWorkflow: vi.fn(async (_wf: Workflow) => {}),
    deleteWorkflow: vi.fn(async (_id: string) => {}),
    saveComposite: vi.fn(async (_c: CompositeDef) => {}),
    deleteComposite: vi.fn(async (_id: string) => {}),
    saveWorkspace: vi.fn(async (_ws: Workspace) => {}),
  } satisfies AutosaveTarget;
  return t;
}

function setup() {
  let seq = 0;
  const app = createAppStore({ newId: () => `id${++seq}`, now: () => 'now' });
  const target = fakeTarget();
  const events = new EventTarget();
  let hidden = false;
  const autosave = createAutosave(app.store, () => target, { delay: 300, events, isHidden: () => hidden });
  const wfId = app.store.getState().workflowOrder[0]!;
  const rename = (name: string) =>
    app.store.setState((d: AppState) => {
      d.workflows[wfId]!.name = name;
    });
  return { app, target, events, autosave, wfId, rename, setHidden: (h: boolean) => (hidden = h) };
}

describe('автосохранение', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('пишет через 300 мс после последнего изменения; серия изменений → одна запись', async () => {
    const { target, rename } = setup();
    rename('a');
    await vi.advanceTimersByTimeAsync(200);
    rename('ab');
    await vi.advanceTimersByTimeAsync(200);
    expect(target.saveWorkflow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(150);
    expect(target.saveWorkflow).toHaveBeenCalledTimes(1);
    expect(target.saveWorkflow.mock.calls[0]![0]).toMatchObject({ name: 'ab' });
  });

  it('пишет только изменённые файлы', async () => {
    const { app, target, rename, autosave } = setup();
    app.store.setState((d: AppState) => {
      d.workflows.other = { id: 'other', name: 'Другой', graph: { nodes: [], edges: [] }, createdAt: 'now', updatedAt: 'now' };
      d.workflowOrder.push('other');
    });
    await autosave.flush();
    target.saveWorkflow.mockClear();
    target.saveWorkspace.mockClear();
    rename('x');
    await autosave.flush();
    expect(target.saveWorkflow).toHaveBeenCalledTimes(1);
    expect(target.saveWorkspace).not.toHaveBeenCalled();
  });

  it('удаление workflow удаляет файл и обновляет workspace', async () => {
    const { app, target, wfId, autosave } = setup();
    app.store.setState((d: AppState) => {
      delete d.workflows[wfId];
      d.workflowOrder = [];
      d.tabs = [];
      d.activeTabId = null;
    });
    await autosave.flush();
    expect(target.deleteWorkflow).toHaveBeenCalledWith(wfId);
    expect(target.saveWorkspace).toHaveBeenCalledWith({ workflowOrder: [], tabs: [], activeTabId: null });
  });

  it('pagehide и visibilitychange (скрыта) сбрасывают отложенную запись немедленно', async () => {
    const { target, rename, events, setHidden } = setup();
    rename('a');
    events.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(target.saveWorkflow).toHaveBeenCalledTimes(1);
    rename('b');
    events.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(target.saveWorkflow).toHaveBeenCalledTimes(1);
    setHidden(true);
    events.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(target.saveWorkflow).toHaveBeenCalledTimes(2);
  });

  it('ошибка записи не теряет изменения и повторяется при следующем изменении', async () => {
    const { app, target, rename, autosave } = setup();
    const onError = vi.fn();
    const failing = createAutosave(app.store, () => target, { delay: 300, onError, events: new EventTarget() });
    autosave.stop();
    target.saveWorkflow.mockRejectedValueOnce(new Error('disk full'));
    rename('a');
    await failing.flush();
    expect(onError).toHaveBeenCalledTimes(1);
    app.store.setState((d: AppState) => {
      d.composites.c = { id: 'c', name: 'c', description: '', graph: { nodes: [], edges: [] }, createdAt: '', updatedAt: '' };
    });
    await failing.flush();
    expect(target.saveWorkflow).toHaveBeenCalledTimes(2);
    expect(target.saveWorkflow.mock.calls[1]![0]).toMatchObject({ name: 'a' });
    expect(target.saveComposite).toHaveBeenCalledTimes(1);
  });

  it('resetBaseline: текущее состояние считается сохранённым', async () => {
    const { target, rename, autosave } = setup();
    rename('loaded');
    autosave.resetBaseline();
    await autosave.flush();
    expect(target.saveWorkflow).not.toHaveBeenCalled();
  });
});

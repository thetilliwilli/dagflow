import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActions } from '../../src/store/actions';
import { startEvaluation } from '../../src/store/evaluation';
import { activeTab, tabGraph } from '../../src/store/store';
import { manualScheduler, testStore } from './helpers';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  const frames = manualScheduler();
  startEvaluation(app, frames.schedule);
  const state = () => app.store.getState();
  const graph = () => tabGraph(state(), activeTab(state()))!;
  const add = (type: string) => {
    const r = actions.addNode(type, { x: 0, y: 0 });
    if (!r.ok) throw new Error(r.message);
    vi.advanceTimersByTime(1000);
    return r.id;
  };
  return { app, actions, frames, state, graph, add };
}

describe('история отмены (FR-009)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('каждое действие — шаг; undo/redo восстанавливают граф и значения (US5 #3)', () => {
    const { actions, frames, state, graph, add } = setup();
    const n = add('builtin:number');
    const s = add('builtin:show');
    actions.setInputValue(n, 'value', 7);
    vi.advanceTimersByTime(1000);
    actions.connect({ node: n, port: 'value' }, { node: s, port: 'value' });
    frames.flushFrames();
    const tab = state().activeTabId!;
    expect(state().nodeStates[tab]![s]!.inputs).toEqual({ value: 7 });

    actions.deleteElements([n], []);
    frames.flushFrames();
    expect(graph().nodes.map((x) => x.id)).toEqual([s]);
    expect(graph().edges).toEqual([]);

    actions.undo();
    frames.flushFrames();
    expect(graph().nodes.map((x) => x.id)).toEqual([n, s]);
    expect(graph().edges).toHaveLength(1);
    expect(state().nodeStates[tab]![s]!.inputs).toEqual({ value: 7 });

    actions.redo();
    expect(graph().nodes.map((x) => x.id)).toEqual([s]);
    expect(actions.canRedo()).toBe(false);
  });

  it('правки одного поля чаще 500 мс объединяются в один шаг', () => {
    const { actions, graph, add } = setup();
    const n = add('builtin:number');
    for (const v of [1, 12, 123]) {
      actions.setInputValue(n, 'value', v);
      vi.advanceTimersByTime(200);
    }
    vi.advanceTimersByTime(1000);
    actions.setInputValue(n, 'value', 9);
    actions.undo();
    expect(graph().nodes[0]!.values).toEqual({ value: 123 });
    actions.undo();
    expect(graph().nodes[0]!.values).toEqual({});
  });

  it('перемещение нода (много событий подряд) — один шаг', () => {
    const { actions, graph, add } = setup();
    const n = add('builtin:number');
    for (let x = 1; x <= 30; x++) actions.moveNode(n, { x, y: 0 });
    actions.undo();
    expect(graph().nodes[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it('история не длиннее 100 шагов', () => {
    const { actions, graph, add } = setup();
    for (let i = 0; i < 101; i++) add('builtin:number');
    while (actions.canUndo()) actions.undo();
    expect(graph().nodes).toHaveLength(1); // первый шаг вытеснен
  });

  it('история своя у каждой вкладки (FR-031a)', () => {
    const { actions, graph, add } = setup();
    add('builtin:number');
    actions.createWorkflow();
    add('builtin:add');
    actions.undo();
    expect(graph().nodes).toEqual([]);
    expect(actions.canUndo()).toBe(false);
    actions.switchTab(actions.tabIds()[0]!);
    expect(actions.canUndo()).toBe(true);
    actions.undo();
    expect(graph().nodes).toEqual([]);
  });

  it('новое действие после undo очищает redo', () => {
    const { actions, add } = setup();
    add('builtin:number');
    actions.undo();
    expect(actions.canRedo()).toBe(true);
    add('builtin:add');
    expect(actions.canRedo()).toBe(false);
  });

  it('отмена сворачивания возвращает группу, определение остаётся; палитра в историю не попадает', () => {
    const { actions, state, graph, add } = setup();
    const a = add('builtin:add');
    const r = actions.collapseSelection([a], 'Сумма');
    if (!r.ok) throw new Error(r.message);
    vi.advanceTimersByTime(1000);
    actions.renameComposite(r.compositeId, 'Сумма 2');
    actions.undo();
    expect(graph().nodes.map((n) => n.id)).toEqual([a]);
    expect(state().composites[r.compositeId]!.name).toBe('Сумма 2');
    actions.redo();
    expect(graph().nodes.map((n) => n.type)).toEqual([`composite:${r.compositeId}`]);
  });

  it('правки значения по умолчанию порта «Вход» чаще 500 мс — один шаг (T105, plan R5)', () => {
    const { actions, state, add } = setup();
    const a = add('builtin:add');
    const sh = add('builtin:show');
    actions.connect({ node: a, port: 'result' }, { node: sh, port: 'value' });
    vi.advanceTimersByTime(1000);
    const r = actions.collapseSelection([a], 'Сумма');
    if (!r.ok) throw new Error(r.message);
    actions.openComposite(r.compositeId);
    const out = state().composites[r.compositeId]!.graph.nodes.find((n) => n.type === 'builtin:output')!;
    expect(out).toBeDefined();
    const ir = actions.addNode('builtin:input', { x: 0, y: 0 });
    if (!ir.ok) throw new Error(ir.message);
    vi.advanceTimersByTime(1000);
    const portsWith = (v?: number) => [{ name: 'in', type: 'number' as const, required: true, ...(v === undefined ? {} : { default: v }) }];
    // Сначала тип порта (отдельный шаг), затем серия правок значения по умолчанию
    expect(actions.editIoPorts(ir.id, portsWith()).ok).toBe(true);
    vi.advanceTimersByTime(1000);
    for (const v of [1, 15]) {
      expect(actions.editIoPorts(ir.id, portsWith(v)).ok).toBe(true);
      vi.advanceTimersByTime(200);
    }
    const input = () => state().composites[r.compositeId]!.graph.nodes.find((n) => n.id === ir.id)!;
    expect(input().ports![0]!.default).toBe(15);
    actions.undo();
    expect(input().ports![0]!.default).toBeUndefined();
  });
});


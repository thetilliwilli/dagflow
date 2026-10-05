import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/store/actions';
import { startEvaluation } from '../../src/store/evaluation';
import { AppProvider } from '../../src/store/react';
import { activeTab, tabGraph } from '../../src/store/store';
import { Workbench } from '../../src/ui/Workbench';
import { manualScheduler, testStore } from './helpers';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  const frames = manualScheduler();
  startEvaluation(app, frames.schedule);
  const state = () => app.store.getState();
  const flush = () => act(() => frames.flushFrames());
  const graph = () => tabGraph(state(), activeTab(state()))!;
  const add = (type: string, values: Record<string, number> = {}) => {
    const r = actions.addNode(type, { x: 0, y: 0 });
    if (!r.ok) throw new Error(r.message);
    for (const [k, v] of Object.entries(values)) actions.setInputValue(r.id, k, v);
    return r.id;
  };
  /** N1(2), N2(3) → Add → Mul(b=2) → Show; свернуть Add и Mul */
  const buildAndCollapse = () => {
    const ids = { n1: '', n2: '', add: '', mul: '', show: '' };
    act(() => {
      ids.n1 = add('builtin:number', { value: 2 });
      ids.n2 = add('builtin:number', { value: 3 });
      ids.add = add('builtin:add');
      ids.mul = add('builtin:multiply', { b: 2 });
      ids.show = add('builtin:show');
      actions.connect({ node: ids.n1, port: 'value' }, { node: ids.add, port: 'a' });
      actions.connect({ node: ids.n2, port: 'value' }, { node: ids.add, port: 'b' });
      actions.connect({ node: ids.add, port: 'result' }, { node: ids.mul, port: 'a' });
      actions.connect({ node: ids.mul, port: 'result' }, { node: ids.show, port: 'value' });
    });
    flush();
    let compositeId = '';
    act(() => {
      const r = actions.collapseSelection([ids.add, ids.mul], 'Удвоенная сумма');
      if (!r.ok) throw new Error(r.message);
      compositeId = r.compositeId;
    });
    flush();
    const inst = graph().nodes.find((n) => n.type === `composite:${compositeId}`)!;
    return { ...ids, compositeId, inst: inst.id, workflowTab: state().activeTabId! };
  };
  const showValue = (tabId: string, nodeId: string) => state().nodeStates[tabId]?.[nodeId]?.inputs.value;
  return { app, actions, state, flush, graph, add, buildAndCollapse, showValue };
}

describe('составные ноды: действия', () => {
  it('свернуть выделение: экземпляр на месте группы, значения не изменились (FR-022)', () => {
    const { buildAndCollapse, graph, showValue } = setup();
    const ids = buildAndCollapse();
    expect(graph().nodes.map((n) => n.id).sort()).toEqual([ids.n1, ids.n2, ids.show, ids.inst].sort());
    expect(showValue(ids.workflowTab, ids.show)).toBe(10);
  });

  it('составной нод появился в палитре; «Вход»/«Выход» в палитре workflow нет (US4 #2)', () => {
    const { app, buildAndCollapse } = setup();
    buildAndCollapse();
    render(
      <AppProvider app={app}>
        <Workbench />
      </AppProvider>,
    );
    const palette = within(screen.getByTestId('palette'));
    expect(palette.getByText('Мои составные ноды')).toBeInTheDocument();
    expect(palette.getByText('Удвоенная сумма')).toBeInTheDocument();
    expect(palette.queryByText('Вход')).toBeNull();
  });

  it('открытие — вкладка вида composite; правка внутри применяется во всех вкладках (FR-031b)', () => {
    const { actions, state, flush, graph, buildAndCollapse, showValue } = setup();
    const ids = buildAndCollapse();
    act(() => actions.openComposite(ids.compositeId));
    expect(activeTab(state())).toMatchObject({ kind: 'composite', targetId: ids.compositeId });
    const mul = graph().nodes.find((n) => n.type === 'builtin:multiply')!;
    act(() => {
      actions.setInputValue(mul.id, 'b', 3);
    });
    flush();
    expect(showValue(ids.workflowTab, ids.show)).toBe(15);
  });

  it('нод «Вход» с портами c, d добавляет входы экземплярам; удаление — убирает (US4 #5)', () => {
    const { app, actions, state, flush, buildAndCollapse } = setup();
    const ids = buildAndCollapse();
    act(() => actions.openComposite(ids.compositeId));
    let inputId = '';
    act(() => {
      const r = actions.addNode('builtin:input', { x: 0, y: 300 });
      if (!r.ok) throw new Error(r.message);
      inputId = r.id;
    });
    const r = actions.editIoPorts(inputId, [
      { name: 'c', type: 'number', required: true },
      { name: 'd', type: 'text', required: true },
    ]);
    expect(r.ok).toBe(true);
    flush();
    const ports = () => {
      const def = state().composites[ids.compositeId]!;
      return def.graph.nodes.filter((n) => n.type === 'builtin:input').flatMap((n) => n.ports!.map((p) => p.name));
    };
    expect(ports()).toEqual(['a', 'b', 'c', 'd']);
    act(() => actions.deleteNodes([inputId]));
    expect(ports()).toEqual(['a', 'b']);
    expect(app.store.getState().composites[ids.compositeId]).toBeDefined();
  });

  it('связи экземпляров с исчезнувшими портами удаляются с уведомлением', () => {
    const { actions, state, buildAndCollapse } = setup();
    const ids = buildAndCollapse();
    act(() => actions.openComposite(ids.compositeId));
    const def = state().composites[ids.compositeId]!;
    const inputA = def.graph.nodes.find((n) => n.type === 'builtin:input' && n.ports![0]!.name === 'a')!;
    act(() => actions.deleteNodes([inputA.id]));
    const wf = Object.values(state().workflows)[0]!;
    expect(wf.graph.edges.some((e) => e.target.node === ids.inst && e.target.port === 'a')).toBe(false);
    expect(wf.graph.edges.some((e) => e.target.node === ids.inst && e.target.port === 'b')).toBe(true);
    expect(state().notifications.at(-1)!.text).toMatch(/Удалено связей: 1/);
  });

  it('дубль имени порта отклоняется (FR-021c)', () => {
    const { actions, buildAndCollapse } = setup();
    const ids = buildAndCollapse();
    act(() => actions.openComposite(ids.compositeId));
    let inputId = '';
    act(() => {
      const r = actions.addNode('builtin:input', { x: 0, y: 0 });
      if (r.ok) inputId = r.id;
    });
    const r = actions.editIoPorts(inputId, [{ name: 'a', type: 'number' }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('duplicate-port-name');
  });

  it('сворачивание и переименование с занятым именем отклоняются (FR-023a)', () => {
    const { actions, add, buildAndCollapse } = setup();
    const ids = buildAndCollapse();
    let other = '';
    act(() => {
      other = add('builtin:add');
    });
    const r = actions.collapseSelection([other], 'Удвоенная сумма');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('занято');
    let second!: ReturnType<typeof actions.collapseSelection>;
    act(() => {
      second = actions.collapseSelection([other], 'Сумма');
    });
    expect(second.ok).toBe(true);
    const rn = actions.renameComposite(ids.compositeId, 'Сумма');
    expect(rn.ok).toBe(false);
  });

  it('удаление используемого составного нода: число экземпляров и подтверждение (FR-027)', async () => {
    const user = userEvent.setup();
    const { app, state, buildAndCollapse } = setup();
    const ids = buildAndCollapse();
    render(
      <AppProvider app={app}>
        <Workbench />
      </AppProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Удалить составной нод «Удвоенная сумма»' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Используется в 1 месте');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }));
    expect(state().composites[ids.compositeId]).toBeUndefined();
    expect(Object.values(state().workflows)[0]!.graph.nodes.some((n) => n.id === ids.inst)).toBe(false);
  });

  it('добавить составной нод внутрь самого себя нельзя (FR-026)', () => {
    const { actions, buildAndCollapse } = setup();
    const ids = buildAndCollapse();
    act(() => actions.openComposite(ids.compositeId));
    const r = actions.addNode(`composite:${ids.compositeId}`, { x: 0, y: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('composite-recursion');
  });

  it('развернуть экземпляр (FR-025)', () => {
    const { actions, flush, graph, buildAndCollapse, showValue } = setup();
    const ids = buildAndCollapse();
    act(() => {
      actions.expandInstance(ids.inst);
    });
    flush();
    expect(graph().nodes.some((n) => n.type.startsWith('composite:'))).toBe(false);
    expect(graph().nodes.map((n) => n.type).sort()).toEqual(['builtin:add', 'builtin:multiply', 'builtin:number', 'builtin:number', 'builtin:show']);
    expect(showValue(ids.workflowTab, ids.show)).toBe(10);
  });
});

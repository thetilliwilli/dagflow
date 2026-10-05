import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/store/actions';
import { startEvaluation } from '../../src/store/evaluation';
import { AppProvider } from '../../src/store/react';
import { activeTab, tabGraph } from '../../src/store/store';
import { Workbench } from '../../src/ui/Workbench';
import { manualScheduler, openPalette, testStore } from './helpers';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  const frames = manualScheduler();
  startEvaluation(app, frames.schedule);
  render(
    <AppProvider app={app}>
      <Workbench />
    </AppProvider>,
  );
  const state = () => app.store.getState();
  const flush = () => act(() => frames.flushFrames());
  return { app, actions, state, flush };
}

describe('T103: входы и выходы на карточке палитры (FR-001)', () => {
  it('у каждого нода видна строка портов', () => {
    setup();
    const add = within(openPalette('Арифметика')).getByText('Сложить').closest('.palette__item') as HTMLElement;
    expect(within(add).getByText('a, b → result')).toBeVisible();
    const show = within(openPalette('Отображение')).getByText('Показать').closest('.palette__item') as HTMLElement;
    expect(within(show).getByText('value → —')).toBeInTheDocument();
  });
});

describe('T104: значения по умолчанию у портов «Вход»', () => {
  function withComposite() {
    const h = setup();
    let addId = '';
    act(() => {
      const r = h.actions.addNode('builtin:add', { x: 0, y: 0 });
      if (r.ok) addId = r.id;
      const n = h.actions.addNode('builtin:number', { x: -300, y: 0 });
      if (n.ok) h.actions.connect({ node: n.id, port: 'value' }, { node: addId, port: 'a' });
      h.actions.setInputValue(addId, 'b', 10);
      // Выход «result» подключён наружу — иначе при сворачивании не появится нод «Выход» (FR-021)
      const sh = h.actions.addNode('builtin:show', { x: 300, y: 0 });
      if (sh.ok) h.actions.connect({ node: addId, port: 'result' }, { node: sh.id, port: 'value' });
    });
    let compositeId = '';
    let instanceId = '';
    act(() => {
      const r = h.actions.collapseSelection([addId], 'Плюс десять');
      if (!r.ok) throw new Error(r.message);
      compositeId = r.compositeId;
      instanceId = r.instanceId;
    });
    return { ...h, compositeId, instanceId };
  }

  it('значение по умолчанию: вкладка составного нода считает, а экземпляр без входа не ждёт', async () => {
    const user = userEvent.setup();
    const { actions, state, flush, compositeId, instanceId } = withComposite();
    const workflowTab = state().activeTabId!;
    // Экземпляр без подключённого входа «a»
    act(() => {
      const wf = Object.values(state().workflows)[0]!;
      const edge = wf.graph.edges.find((e) => e.target.node === instanceId)!;
      actions.disconnect(edge.id);
    });
    flush();
    expect(state().nodeStates[workflowTab]![instanceId]!.status).toBe('waiting');

    act(() => actions.openComposite(compositeId));
    await user.type(screen.getByLabelText('По умолчанию: a'), '5');
    flush();
    const def = state().composites[compositeId]!;
    const input = def.graph.nodes.find((n) => n.type === 'builtin:input')!;
    expect(input.ports![0]!.default).toBe(5);
    const inner = tabGraph(state(), activeTab(state()))!.nodes.find((n) => n.type === 'builtin:add')!;
    expect(state().nodeStates[state().activeTabId!]![inner.id]!.outputs).toEqual({ result: 15 });
    expect(state().nodeStates[workflowTab]![instanceId]).toMatchObject({ status: 'ok', outputs: { result: 15 } });
  });

  it('значение не того типа отклоняется; смена типа сбрасывает значение по умолчанию', () => {
    const { actions, state, compositeId } = withComposite();
    act(() => actions.openComposite(compositeId));
    const input = state().composites[compositeId]!.graph.nodes.find((n) => n.type === 'builtin:input')!;
    const bad = actions.editIoPorts(input.id, [{ name: 'a', type: 'number', required: true, default: 'пять' }]);
    expect(bad.ok).toBe(false);
    actions.editIoPorts(input.id, [{ name: 'a', type: 'number', required: true, default: 5 }]);
    actions.editIoPorts(input.id, [{ name: 'a', type: 'text', required: true, default: 5 }]);
    const port = state().composites[compositeId]!.graph.nodes.find((n) => n.id === input.id)!.ports![0]!;
    expect(port.default).toBeUndefined();
  });
});

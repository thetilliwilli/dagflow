// Окно связей между двумя нодами с удалением крестиком (US5 #4, #5, #7; FR-025)
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/store/actions';
import { AppProvider } from '../../src/store/react';
import { activeTab, tabGraph } from '../../src/store/store';
import type { UiActions } from '../../src/store/ui';
import { Workbench } from '../../src/ui/Workbench';
import { testStore, UiProbe } from './helpers';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  let ui!: UiActions;
  render(
    <AppProvider app={app}>
      <Workbench />
      <UiProbe onReady={(u) => (ui = u)} />
    </AppProvider>,
  );
  const graph = () => tabGraph(app.store.getState(), activeTab(app.store.getState()))!;
  let num = '';
  let sum = '';
  act(() => {
    const n = actions.addNode('builtin:number', { x: 0, y: 0 });
    const s = actions.addNode('builtin:add', { x: 300, y: 0 });
    if (!n.ok || !s.ok) throw new Error();
    num = n.id;
    sum = s.id;
    actions.renameNode(num, 'Источник');
    actions.connect({ node: num, port: 'value' }, { node: sum, port: 'a' });
    actions.connect({ node: num, port: 'value' }, { node: sum, port: 'b' });
  });
  act(() => ui.openEdgeWindow(num, sum, { x: 200, y: 200 }));
  const win = () => screen.queryByRole('dialog', { name: 'Связи: Источник → Сложить' });
  return { actions, graph, win, ui: () => ui };
}

describe('окно связей', () => {
  it('#4: список всех связей пары', () => {
    const h = setup();
    const items = within(h.win()!).getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('.edge-list__label')!.textContent)).toEqual([
      'value→a',
      'value→b',
    ]);
  });

  it('длинная связь: строка с многоточием, полный текст — во всплывающей подсказке', () => {
    const h = setup();
    const label = within(h.win()!).getAllByRole('listitem')[0]!.querySelector('.edge-list__label')!;
    expect(label).toHaveAttribute('title', 'value→a');
  });

  it('#5: крестик удаляет только свою связь', () => {
    const h = setup();
    fireEvent.click(within(h.win()!).getByRole('button', { name: 'Удалить связь «value→b»' }));
    expect(h.graph().edges.map((e) => e.target.port)).toEqual(['a']);
    expect(within(h.win()!).getAllByRole('listitem')).toHaveLength(1);
  });

  it('связь удалена извне — список обновился; связей не осталось — окно закрылось', () => {
    const h = setup();
    act(() => h.actions.deleteElements([], [h.graph().edges[0]!.id]));
    expect(within(h.win()!).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(within(h.win()!).getByRole('button', { name: 'Удалить связь «value→b»' }));
    expect(h.win()).toBeNull();
  });

  it('#7: «Закрыть» и Escape закрывают окно', () => {
    const h = setup();
    fireEvent.click(within(h.win()!).getByRole('button', { name: 'Закрыть' }));
    expect(h.win()).toBeNull();
    const [e] = h.graph().edges;
    act(() => h.ui().openEdgeWindow(e!.source.node, e!.target.node, { x: 0, y: 0 }));
    expect(h.win()).not.toBeNull();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(h.win()).toBeNull();
  });
});

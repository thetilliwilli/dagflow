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
  render(
    <AppProvider app={app}>
      <Workbench />
    </AppProvider>,
  );
  const state = () => app.store.getState();
  const list = () => within(screen.getByTestId('workflow-list'));
  const tabs = () => within(screen.getByTestId('tab-bar'));
  return { app, actions, state, list, tabs, user: userEvent.setup() };
}

describe('список workflow и вкладки', () => {
  it('создание workflow открывает его во вкладке (FR-031)', async () => {
    const { state, list, tabs, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Создать workflow' }));
    expect(state().workflowOrder).toHaveLength(2);
    expect(list().getAllByRole('listitem')).toHaveLength(2);
    expect(tabs().getAllByRole('tab')).toHaveLength(2);
    expect(tabs().getByRole('tab', { selected: true })).toHaveTextContent('Новый workflow 2');
  });

  it('переименование (пустое имя отклоняется)', async () => {
    const { state, list, user } = setup();
    const id = state().workflowOrder[0]!;
    await user.click(list().getByRole('button', { name: 'Переименовать «Новый workflow»' }));
    const input = list().getByRole('textbox', { name: 'Имя workflow' });
    await user.clear(input);
    await user.type(input, '{Enter}');
    expect(state().workflows[id]!.name).toBe('Новый workflow');
    await user.click(list().getByRole('button', { name: 'Переименовать «Новый workflow»' }));
    const input2 = list().getByRole('textbox', { name: 'Имя workflow' });
    await user.clear(input2);
    await user.type(input2, 'Калькулятор{Enter}');
    expect(state().workflows[id]!.name).toBe('Калькулятор');
  });

  it('дублирование создаёт копию с тем же графом', async () => {
    const { app, actions, state, list, user } = setup();
    act(() => {
      actions.addNode('builtin:number', { x: 0, y: 0 });
    });
    const id = state().workflowOrder[0]!;
    await user.click(list().getByRole('button', { name: 'Дублировать «Новый workflow»' }));
    const copyId = state().workflowOrder[1]!;
    expect(state().workflows[copyId]!.name).toBe('Новый workflow (копия)');
    expect(state().workflows[copyId]!.graph).toEqual(state().workflows[id]!.graph);
    expect(app.store.getState().workflowOrder).toEqual([id, copyId]);
  });

  it('две вкладки: переключение сохраняет граф каждой (US3 #4)', async () => {
    const { actions, state, tabs, user } = setup();
    act(() => {
      actions.addNode('builtin:number', { x: 0, y: 0 });
    });
    await user.click(screen.getByRole('button', { name: 'Создать workflow' }));
    act(() => {
      actions.addNode('builtin:add', { x: 0, y: 0 });
      actions.addNode('builtin:add', { x: 50, y: 0 });
    });
    const graphOf = () => tabGraph(state(), activeTab(state()))!;
    expect(graphOf().nodes).toHaveLength(2);
    await user.click(tabs().getByRole('tab', { name: /^Новый workflow$/ }));
    expect(graphOf().nodes.map((n) => n.type)).toEqual(['builtin:number']);
    await user.click(tabs().getByRole('tab', { name: /Новый workflow 2/ }));
    expect(graphOf().nodes).toHaveLength(2);
  });

  it('повторное открытие открытого workflow переключает на его вкладку (FR-031a)', async () => {
    const { state, list, tabs, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Создать workflow' }));
    await user.click(list().getByRole('button', { name: 'Открыть «Новый workflow»' }));
    expect(tabs().getAllByRole('tab')).toHaveLength(2);
    expect(activeTab(state())!.targetId).toBe(state().workflowOrder[0]);
  });

  it('закрытие вкладки не удаляет workflow; открытие возвращает вкладку', async () => {
    const { state, list, tabs, user } = setup();
    await user.click(tabs().getByRole('button', { name: 'Закрыть вкладку «Новый workflow»' }));
    expect(tabs().queryAllByRole('tab')).toHaveLength(0);
    expect(state().workflowOrder).toHaveLength(1);
    expect(screen.getByText('Откройте workflow из списка или создайте новый')).toBeInTheDocument();
    await user.click(list().getByRole('button', { name: 'Открыть «Новый workflow»' }));
    expect(tabs().getAllByRole('tab')).toHaveLength(1);
  });

  it('удаление требует подтверждения и закрывает вкладку (US3 #8)', async () => {
    const { state, list, tabs, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Создать workflow' }));
    const id = state().workflowOrder[1]!;
    await user.click(list().getByRole('button', { name: 'Удалить «Новый workflow 2»' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(state().workflows[id]).toBeDefined();
    await user.click(list().getByRole('button', { name: 'Удалить «Новый workflow 2»' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }));
    expect(state().workflows[id]).toBeUndefined();
    expect(tabs().getAllByRole('tab')).toHaveLength(1);
  });

  it('недоступный workflow показан с причиной', () => {
    const { app, list } = setup();
    act(() => {
      app.store.setState({ unavailable: [{ id: 'bad', kind: 'workflow', reason: 'Файл повреждён: ...' }] });
    });
    expect(list().getByText(/bad/)).toBeInTheDocument();
    expect(list().getByText(/Файл повреждён/)).toBeInTheDocument();
  });
});

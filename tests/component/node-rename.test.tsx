// Переименование нода двойным щелчком — на карточке и в окне свойств (US2 #2, #4; FR-009)
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  let id = '';
  act(() => {
    const r = actions.addNode('builtin:add', { x: 0, y: 0 });
    if (r.ok) id = r.id;
  });
  const name = () =>
    tabGraph(app.store.getState(), activeTab(app.store.getState()))!.nodes[0]!.name;
  const card = () => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!;
  const startOnCard = () => fireEvent.doubleClick(card().querySelector('.flow-node__name')!);
  return { id, name, card, startOnCard, ui: () => ui, user: userEvent.setup() };
}

describe('переименование нода', () => {
  it('#2: двойной щелчок по имени — поле; Enter сохраняет', async () => {
    const h = setup();
    h.startOnCard();
    const input = within(h.card()).getByRole('textbox', { name: 'Node name' });
    expect(input).toHaveValue('Add');
    await h.user.clear(input);
    await h.user.type(input, 'Итого{Enter}');
    expect(h.name()).toBe('Итого');
    expect(within(h.card()).queryByRole('textbox')).toBeNull();
    expect(h.card().querySelector('.flow-node__name')).toHaveTextContent('Итого');
  });

  it('потеря фокуса тоже сохраняет', async () => {
    const h = setup();
    h.startOnCard();
    const input = within(h.card()).getByRole('textbox', { name: 'Node name' });
    await h.user.clear(input);
    await h.user.type(input, 'Сумма');
    fireEvent.blur(input);
    expect(h.name()).toBe('Сумма');
  });

  it('#4: Escape отменяет ввод', async () => {
    const h = setup();
    h.startOnCard();
    const input = within(h.card()).getByRole('textbox', { name: 'Node name' });
    await h.user.clear(input);
    await h.user.type(input, 'Другое{Escape}');
    expect(h.name()).toBe('Add');
    expect(within(h.card()).queryByRole('textbox')).toBeNull();
  });

  it('#4: пустое имя не принимается — текст отказа под полем, имя прежнее', async () => {
    const h = setup();
    h.startOnCard();
    const input = within(h.card()).getByRole('textbox', { name: 'Node name' });
    await h.user.clear(input);
    await h.user.type(input, '   {Enter}');
    expect(h.name()).toBe('Add');
    expect(within(h.card()).getByRole('alert')).toHaveTextContent(
      'The node name cannot be empty. Enter at least one character.',
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('FR-009: тот же редактор — в заголовке окна свойств', async () => {
    const h = setup();
    act(() => h.ui().setSelection([h.id]));
    const grid = screen.getByRole('dialog', { name: 'Properties' });
    fireEvent.doubleClick(within(grid).getByTestId('prop-grid-name'));
    const input = within(grid).getByRole('textbox', { name: 'Node name' });
    await h.user.clear(input);
    await h.user.type(input, 'Из окна{Enter}');
    expect(h.name()).toBe('Из окна');
    expect(within(grid).getByTestId('prop-grid-name')).toHaveTextContent('Из окна');
  });
});

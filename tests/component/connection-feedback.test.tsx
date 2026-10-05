import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createActions } from '../../src/store/actions';
import { AppProvider } from '../../src/store/react';
import { activeTab, tabGraph } from '../../src/store/store';
import { tryConnect } from '../../src/ui/canvas/connection';
import { Notifications } from '../../src/ui/layout/Notifications';
import { testStore } from './helpers';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  const add = (type: string) => {
    const r = actions.addNode(type, { x: 0, y: 0 });
    if (!r.ok) throw new Error(r.message);
    return r.id;
  };
  render(
    <AppProvider app={app}>
      <Notifications />
    </AppProvider>,
  );
  const edges = () => tabGraph(app.store.getState(), activeTab(app.store.getState()))!.edges;
  return { app, actions, add, edges };
}

describe('объяснение отказа в соединении', () => {
  it('цикл: связь не создаётся, показано уведомление (US2 #1)', () => {
    const { actions, add, edges } = setup();
    const a = add('builtin:add');
    const b = add('builtin:add');
    const c = add('builtin:add');
    act(() => {
      tryConnect(actions, { node: a, port: 'result' }, { node: b, port: 'a' });
      tryConnect(actions, { node: b, port: 'result' }, { node: c, port: 'a' });
    });
    expect(edges()).toHaveLength(2);
    act(() => {
      tryConnect(actions, { node: c, port: 'result' }, { node: a, port: 'a' });
    });
    expect(edges()).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent(/цикл/);
  });

  it('несовместимые типы: связь не создаётся, показаны оба типа (US2 #2, SC-004)', () => {
    const { actions, add, edges } = setup();
    const t = add('builtin:text');
    const s = add('builtin:add');
    act(() => {
      tryConnect(actions, { node: t, port: 'value' }, { node: s, port: 'a' });
    });
    expect(edges()).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Несовместимые типы: текст → число');
  });

  it('успешное соединение уведомлений не показывает', () => {
    const { actions, add, edges } = setup();
    const n = add('builtin:number');
    const s = add('builtin:add');
    act(() => {
      tryConnect(actions, { node: n, port: 'value' }, { node: s, port: 'a' });
    });
    expect(edges()).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('уведомление скрывается через 5 с и закрывается вручную', async () => {
    vi.useFakeTimers();
    try {
      const { app, actions } = setup();
      act(() => {
        actions.notify('error', 'Первое');
      });
      expect(screen.getByText('Первое')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.queryByText('Первое')).toBeNull();
      act(() => {
        actions.notify('info', 'Второе');
      });
      act(() => {
        screen.getByRole('button', { name: 'Закрыть уведомление' }).click();
      });
      expect(app.store.getState().notifications).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

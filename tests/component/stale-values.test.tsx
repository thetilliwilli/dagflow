// Без связи с целью: последние известные значения приглушены, редактирование работает (US3 #1, #2, #7)
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/store/actions';
import { startEngine } from '../../src/store/engine';
import { AppProvider } from '../../src/store/react';
import { activeTab, createAppStore, isStale } from '../../src/store/store';
import { initialEngine } from '../../src/engine-link/types';
import { Workbench } from '../../src/ui/Workbench';
import { manualScheduler, testStore, UiProbe } from './helpers';
import type { UiActions } from '../../src/store/ui';

function setup() {
  const app = testStore();
  const frames = manualScheduler();
  startEngine(app, { schedule: frames.schedule });
  const actions = createActions(app);
  let ui!: UiActions;
  render(
    <AppProvider app={app}>
      <UiProbe onReady={(u) => (ui = u)} />
      <Workbench />
    </AppProvider>,
  );
  return { app, frames, actions, ui: () => ui };
}

describe('приглушённые значения без связи (FR-019)', () => {
  it('Local готов — значения не приглушены', () => {
    const { app } = setup();
    const tabId = activeTab(app.store.getState())!.id;
    expect(isStale(app.store.getState(), tabId)).toBe(false);
  });

  it('offline → нод приглушён, в «Properties» — «Last known value — engine offline»; правки работают', () => {
    const { app, frames, actions, ui } = setup();
    const r = actions.addNode('builtin:number', { x: 0, y: 0 });
    if (!r.ok) throw new Error(r.message);
    act(() => frames.flushFrames());
    act(() => ui().setSelection([r.id]));
    act(() =>
      app.store.setState((d) => {
        d.engine.status = { kind: 'offline', attempt: 1, retryAt: Date.now() + 500 };
      }),
    );
    expect(document.querySelector(`.react-flow__node[data-id="${r.id}"] .flow-node`)).toHaveClass(
      'is-stale',
    );
    expect(screen.getByText('Last known value — engine offline')).toBeInTheDocument();
    // Редактирование не блокируется (US3 #2)
    const second = actions.addNode('builtin:number', { x: 200, y: 0 });
    expect(second.ok).toBe(true);
    actions.setInputValue(r.id, 'value', 7);
    const wf = Object.values(app.store.getState().workflows)[0]!;
    expect(wf.graph.nodes.find((n) => n.id === r.id)!.values.value).toBe(7);
  });

  it('старт с недоступной сохранённой целью → редактор работает, «Offline» и «Use local engine» (US3 #7, FR-022)', async () => {
    const app = createAppStore(undefined, {
      engine: { ...initialEngine(), target: { kind: 'server', address: 'localhost:1' } },
    });
    startEngine(app, {
      open: () => ({
        result: Promise.resolve({ ok: false, reason: 'unreachable' }),
        cancel: () => {},
      }),
    });
    render(
      <AppProvider app={app}>
        <Workbench />
      </AppProvider>,
    );
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(screen.getByRole('button', { name: /^Engine: / })).toHaveTextContent(
      /◌ Offline — retrying in \d+ s/,
    );
    expect(screen.getByRole('button', { name: 'Use local engine' })).toBeInTheDocument();
    expect(createActions(app).addNode('builtin:number', { x: 0, y: 0 }).ok).toBe(true);
  });
});

import { act, render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/store/actions';
import { startEvaluation } from '../../src/store/evaluation';
import { AppProvider } from '../../src/store/react';
import { Editor } from '../../src/ui/Editor';
import type { UiActions } from '../../src/store/ui';
import { manualScheduler, testStore, UiProbe } from './helpers';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  const frames = manualScheduler();
  startEvaluation(app, frames.schedule);
  let ui!: UiActions;
  const view = render(
    <AppProvider app={app}>
      <Editor />
      <UiProbe onReady={(u) => (ui = u)} />
    </AppProvider>,
  );
  const add = (type: string, values: Record<string, number> = {}) => {
    const r = actions.addNode(type, { x: 0, y: 0 });
    if (!r.ok) throw new Error(r.message);
    for (const [k, v] of Object.entries(values)) actions.setInputValue(r.id, k, v);
    return r.id;
  };
  const flush = () => act(() => frames.flushFrames());
  const nodeEl = (id: string) =>
    within(view.container.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!);
  /** Значение входа нода — в окне свойств (фича 002: на карточке значений нет). */
  const inputValue = (id: string, port: string) => {
    act(() => ui.setSelection([id]));
    return view.container.querySelector(
      `.prop-grid li.prop-row[data-side="in"][data-port="${port}"] .value-view`,
    );
  };
  return { actions, add, flush, nodeEl, inputValue };
}

describe('статусы нодов', () => {
  it('пустой обязательный вход: «ожидает входов» и какой вход заполнить (US2 #3)', () => {
    const { add, flush, nodeEl } = setup();
    let s = '';
    act(() => {
      s = add('builtin:add', { a: 1 });
    });
    flush();
    const el = nodeEl(s);
    expect(el.getByTestId('node-status')).toHaveTextContent('ожидает входов');
    expect(el.getByTestId('node-message')).toHaveTextContent('Заполните вход «b»');
  });

  it('ошибка: текст без трассировки; потомки — «проблема выше по графу» (US2 #4, #6)', () => {
    const { actions, add, flush, nodeEl } = setup();
    let div = '';
    let show = '';
    act(() => {
      div = add('builtin:divide', { a: 1, b: 0 });
      show = add('builtin:show');
      actions.connect({ node: div, port: 'result' }, { node: show, port: 'value' });
    });
    flush();
    expect(nodeEl(div).getByTestId('node-status')).toHaveTextContent('ошибка');
    expect(nodeEl(div).getByTestId('node-message')).toHaveTextContent(
      'Деление на ноль: задайте ненулевой делитель',
    );
    expect(nodeEl(div).getByTestId('node-message').textContent).not.toMatch(/at |Error/);
    expect(nodeEl(show).getByTestId('node-status')).toHaveTextContent(
      'не вычислен: проблема выше по графу',
    );
    expect(nodeEl(show).getByTestId('node-message')).toHaveTextContent('Разделить');
  });

  it('потомки нода, ожидающего входов, тоже «проблема выше по графу»', () => {
    const { actions, add, flush, nodeEl } = setup();
    let sum = '';
    let show = '';
    act(() => {
      sum = add('builtin:add');
      show = add('builtin:show');
      actions.connect({ node: sum, port: 'result' }, { node: show, port: 'value' });
    });
    flush();
    expect(nodeEl(show).getByTestId('node-status')).toHaveTextContent(
      'не вычислен: проблема выше по графу',
    );
    expect(nodeEl(show).getByTestId('node-message')).toHaveTextContent('ожидает входов');
  });

  it('после исправления статусы возвращаются к «вычислен» (US2 #5)', () => {
    const { actions, add, flush, nodeEl, inputValue } = setup();
    let div = '';
    let show = '';
    act(() => {
      div = add('builtin:divide', { a: 1, b: 0 });
      show = add('builtin:show');
      actions.connect({ node: div, port: 'result' }, { node: show, port: 'value' });
    });
    flush();
    act(() => {
      actions.setInputValue(div, 'b', 4);
    });
    flush();
    expect(nodeEl(div).getByTestId('node-status')).toHaveTextContent('вычислен');
    expect(nodeEl(div).queryByTestId('node-message')).toBeNull();
    expect(inputValue(show, 'value')).toHaveTextContent('0.25');
  });
});

// Карточка нода (фича 002, US2): тип, имя, значок состояния, строка проблемы; без портов и значений
// (FR-007, FR-008, FR-011)
import { act, render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/store/actions';
import { startEvaluation } from '../../src/store/evaluation';
import { AppProvider } from '../../src/store/react';
import type { AppState } from '../../src/store/store';
import type { UiActions } from '../../src/store/ui';
import { Editor } from '../../src/ui/Editor';
import { manualScheduler, testStore, UiProbe } from './helpers';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  const frames = manualScheduler();
  startEvaluation(app, frames.schedule);
  let ui!: UiActions;
  const add = (type: string, values: Record<string, number> = {}) => {
    const r = actions.addNode(type, { x: 0, y: 0 });
    if (!r.ok) throw new Error(r.message);
    for (const [k, v] of Object.entries(values)) actions.setInputValue(r.id, k, v);
    return r.id;
  };
  const view = render(
    <AppProvider app={app}>
      <Editor />
      <UiProbe onReady={(u) => (ui = u)} />
    </AppProvider>,
  );
  const flush = () => act(() => frames.flushFrames());
  const card = (id: string) =>
    view.container.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"] .flow-node`)!;
  return { app, actions, add, flush, card, ui: () => ui };
}

describe('карточка нода (US2)', () => {
  it('#1: тип слева вверху, имя по центру; полный текст — во всплывающей подсказке', () => {
    const h = setup();
    let id = '';
    act(() => {
      id = h.add('builtin:add');
      h.actions.renameNode(id, 'Итого');
    });
    const el = h.card(id);
    expect(el.querySelector('.flow-node__type')).toHaveTextContent('Сложить');
    expect(el.querySelector('.flow-node__type')).toHaveAttribute('title', 'Сложить');
    expect(el.querySelector('.flow-node__name')).toHaveTextContent('Итого');
    expect(el.querySelector('.flow-node__name')).toHaveAttribute('title', 'Итого');
  });

  it('на карточке нет портов, значений и полей ввода', () => {
    const h = setup();
    let id = '';
    act(() => {
      id = h.add('builtin:add', { a: 2, b: 3 });
    });
    h.flush();
    const el = h.card(id);
    expect(within(el).queryByRole('textbox')).toBeNull();
    expect(within(el).queryByText('a: число')).toBeNull();
    expect(within(el).queryByText('5')).toBeNull();
    expect(el.querySelectorAll('.port-row')).toHaveLength(0);
    // Две служебные невидимые «ручки» — только чтобы React Flow мог нарисовать линию (research R3)
    const anchors = el.querySelectorAll('.react-flow__handle');
    expect(anchors).toHaveLength(2);
    for (const a of anchors) expect(a).toHaveClass('flow-node__anchor');
  });

  it('FR-008: значок состояния всегда, строка проблемы — только при ожидании, ошибке и блокировке', () => {
    const h = setup();
    let ok = '';
    let waiting = '';
    let error = '';
    let blocked = '';
    act(() => {
      ok = h.add('builtin:number', { value: 1 });
      waiting = h.add('builtin:add', { a: 1 });
      error = h.add('builtin:divide', { a: 1, b: 0 });
      blocked = h.add('builtin:show');
      h.actions.connect({ node: error, port: 'result' }, { node: blocked, port: 'value' });
    });
    h.flush();
    const problem = (id: string) => h.card(id).querySelector('.flow-node__problem');
    expect(within(h.card(ok)).getByTestId('node-status')).toHaveTextContent('вычислен');
    expect(problem(ok)).toBeNull();
    expect(problem(waiting)).toHaveTextContent('Заполните вход «b»');
    expect(problem(waiting)).toHaveAttribute('title', 'Заполните вход «b»');
    expect(problem(error)).toHaveTextContent('Деление на ноль: задайте ненулевой делитель');
    expect(problem(blocked)).toHaveTextContent('выше по графу');
    for (const id of [waiting, error, blocked]) {
      expect(within(h.card(id)).getByTestId('node-status')).toBeInTheDocument();
    }
  });

  it('#6: выделенный нод — класс is-selected; у нескольких — у каждого', () => {
    const h = setup();
    let a = '';
    let b = '';
    act(() => {
      a = h.add('builtin:number');
      b = h.add('builtin:number');
    });
    expect(h.card(a)).not.toHaveClass('is-selected');
    act(() => h.ui().setSelection([a]));
    expect(h.card(a)).toHaveClass('is-selected');
    expect(h.card(b)).not.toHaveClass('is-selected');
    act(() => h.ui().setSelection([a, b]));
    expect(h.card(a)).toHaveClass('is-selected');
    expect(h.card(b)).toHaveClass('is-selected');
  });

  it('нод неизвестного типа: тип «Неизвестный нод», имя и причина', () => {
    const h = setup();
    act(() => {
      h.app.store.setState((d: AppState) => {
        Object.values(d.workflows)[0]!.graph.nodes.push({
          id: 'ghost',
          type: 'composite:missing',
          name: 'Призрак',
          position: { x: 0, y: 0 },
          values: {},
        });
      });
    });
    h.flush();
    const el = h.card('ghost');
    expect(el.querySelector('.flow-node__type')).toHaveTextContent('Неизвестный нод');
    expect(el.querySelector('.flow-node__name')).toHaveTextContent('Призрак');
    expect(el.querySelector('.flow-node__problem')).toHaveTextContent('composite:missing');
  });
});

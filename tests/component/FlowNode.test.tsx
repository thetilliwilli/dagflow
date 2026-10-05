import { act, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/store/actions';
import { startEvaluation } from '../../src/store/evaluation';
import { AppProvider } from '../../src/store/react';
import { Editor } from '../../src/ui/Editor';
import { manualScheduler, testStore } from './helpers';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  const frames = manualScheduler();
  startEvaluation(app, frames.schedule);
  const add = (type: string, x = 0) => {
    const r = actions.addNode(type, { x, y: 0 });
    if (!r.ok) throw new Error(r.message);
    return r.id;
  };
  const view = render(
    <AppProvider app={app}>
      <Editor />
    </AppProvider>,
  );
  const flush = () => act(() => frames.flushFrames());
  const nodeEl = (id: string) => view.container.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!;
  return { app, actions, add, flush, nodeEl };
}

describe('FlowNode', () => {
  it('показывает заголовок, входы и выходы с типами и значениями (US1 #1, FR-015)', async () => {
    const { actions, add, flush, nodeEl } = setup();
    let id = '';
    act(() => {
      id = add('builtin:add');
      actions.setInputValue(id, 'a', 2);
      actions.setInputValue(id, 'b', 3);
    });
    flush();
    const el = within(nodeEl(id));
    expect(el.getByText('Сложить')).toBeInTheDocument();
    expect(el.getByText('a: число')).toBeInTheDocument();
    expect(el.getByText('b: число')).toBeInTheDocument();
    expect(el.getByText('result: число')).toBeInTheDocument();
    expect(el.getByTestId('out-result')).toHaveTextContent('5');
  });

  it('неподключённый вход редактируется на ноде, подключённый — только для чтения (FR-007)', async () => {
    const user = userEvent.setup();
    const { app, actions, add, flush, nodeEl } = setup();
    let num = '';
    let sum = '';
    act(() => {
      num = add('builtin:number');
      sum = add('builtin:add', 300);
      actions.setInputValue(num, 'value', 7);
      actions.connect({ node: num, port: 'value' }, { node: sum, port: 'a' });
    });
    flush();
    const sumEl = within(nodeEl(sum));
    expect(sumEl.queryByLabelText('a')).toBeNull();
    expect(sumEl.getByTestId('in-a')).toHaveTextContent('7');
    const inputB = sumEl.getByLabelText('b');
    await user.type(inputB, '5');
    flush();
    const g = Object.values(app.store.getState().workflows)[0]!.graph;
    expect(g.nodes.find((n) => n.id === sum)!.values).toEqual({ b: 5 });
    expect(sumEl.getByTestId('out-result')).toHaveTextContent('12');
  });

  it('большое значение отображается компактно и раскрывается по клику (FR-007a)', async () => {
    const user = userEvent.setup();
    const { actions, add, flush, nodeEl } = setup();
    let j = '';
    act(() => {
      j = add('builtin:json');
      actions.setInputValue(j, 'value', Array.from({ length: 50 }, (_, i) => i));
    });
    flush();
    const out = within(nodeEl(j)).getByTestId('out-value');
    expect(out).toHaveTextContent('[50 элементов]');
    await user.click(within(out).getByRole('button', { name: 'показать' }));
    expect(out.querySelector('pre')).toHaveTextContent('49');
  });
});

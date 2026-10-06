// Временное окно свойств при связывании: те же строки, недоступные — затенены (US4 #2, #9, FR-020)
import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AppState } from '../../src/store/store';
import { createActions } from '../../src/store/actions';
import { AppProvider } from '../../src/store/react';
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
  const add = (type: string) => {
    let id = '';
    act(() => {
      const r = actions.addNode(type, { x: 0, y: 0 });
      if (!r.ok) throw new Error(r.message);
      id = r.id;
    });
    return id;
  };
  return { app, actions, add, ui: () => ui };
}

const rowsOf = (win: HTMLElement) =>
  [...win.querySelectorAll('li.prop-row')].map(
    (li) => `${li.getAttribute('data-side')}:${li.getAttribute('data-port')}`,
  );
const peek = (name: string) => screen.getByRole('dialog', { name: `Properties: ${name}` });
const peekRow = (name: string, side: string, port: string) =>
  peek(name).querySelector<HTMLElement>(`li.prop-row[data-side="${side}"][data-port="${port}"]`)!;

/** Начать перетаскивание выхода `port` нода `node` и навести курсор на нод `target`. */
function dragTo(ui: UiActions, node: string, port: string, target: string) {
  act(() => {
    ui.setSelection([node]);
    ui.pressLink({ node, port, side: 'out' }, { x: 0, y: 0 }, false);
    ui.movePointer({ x: 50, y: 0 });
    ui.setPeek(target);
  });
}

describe('временное окно (PeekGrid)', () => {
  it('тот же набор и порядок строк, что в окне свойств нода (FR-020)', () => {
    const h = setup();
    const sum = h.add('builtin:add');
    const text = h.add('builtin:text');
    act(() => h.ui().setSelection([sum]));
    const own = rowsOf(screen.getByRole('dialog', { name: 'Properties' }));
    dragTo(h.ui(), text, 'value', sum);
    expect(peek('Add')).toHaveAttribute('data-peek-node', sum);
    expect(rowsOf(peek('Add'))).toEqual(own);
  });

  it('недоступные строки затенены, но на месте; причина — во всплывающей подсказке (US4 #2)', () => {
    const h = setup();
    const sum = h.add('builtin:add');
    const text = h.add('builtin:text');
    dragTo(h.ui(), text, 'value', sum);
    for (const port of ['a', 'b']) {
      const r = peekRow('Add', 'in', port);
      expect(r).toHaveClass('is-disabled');
      expect(r).toHaveAttribute('aria-disabled', 'true');
      expect(r).toHaveAttribute(
        'title',
        expect.stringContaining('Incompatible types: text → number'),
      );
    }
    expect(peekRow('Add', 'out', 'result')).toHaveAttribute(
      'title',
      'Cannot link an output to an output: a link goes from an output of one node to an input of another.',
    );
    expect(rowsOf(peek('Add'))).toEqual(['in:a', 'in:b', 'out:result']);
  });

  it('совместимые входы доступны', () => {
    const h = setup();
    const sum = h.add('builtin:add');
    const num = h.add('builtin:number');
    dragTo(h.ui(), num, 'value', sum);
    expect(peekRow('Add', 'in', 'a')).not.toHaveClass('is-disabled');
    expect(peekRow('Add', 'in', 'a')).toHaveAttribute('aria-disabled', 'false');
    expect(peekRow('Add', 'out', 'result')).toHaveClass('is-disabled');
  });

  it('режим привязки: маркер нажат, строка выделена, подсказка видна (US4 #9)', () => {
    const h = setup();
    const num = h.add('builtin:number');
    const sum = h.add('builtin:add');
    act(() => {
      h.ui().setSelection([num]);
      h.ui().pressLink({ node: num, port: 'value', side: 'out' }, { x: 0, y: 0 }, true);
      h.ui().releasePointer();
    });
    const grid = screen.getByRole('dialog', { name: 'Properties' });
    const out = grid.querySelector<HTMLElement>('li.prop-row[data-side="out"][data-port="value"]')!;
    expect(within(out).getByRole('button', { name: 'Link “value”' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(out).toHaveClass('is-linking');
    expect(grid).toHaveTextContent('Pick a node and a property to link');
    act(() => h.ui().setPeek(sum));
    expect(peek('Add')).toHaveTextContent('Pick a node and a property to link');
  });

  it('нод неизвестного типа: вместо строк — причина (граничный случай)', () => {
    const h = setup();
    const num = h.add('builtin:number');
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
    dragTo(h.ui(), num, 'value', 'ghost');
    expect(peek('Призрак').querySelectorAll('li.prop-row')).toHaveLength(0);
    expect(peek('Призрак')).toHaveTextContent('Unknown node type: composite:missing.');
  });
});

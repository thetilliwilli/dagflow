// Окно свойств выделенного нода (US3, FR-012 – FR-017, FR-013a, FR-013b, SC-009)
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/store/actions';
import { startEvaluation } from '../../src/store/evaluation';
import { AppProvider } from '../../src/store/react';
import { activeTab, tabGraph } from '../../src/store/store';
import type { UiActions } from '../../src/store/ui';
import { Workbench } from '../../src/ui/Workbench';
import { manualScheduler, testStore, UiProbe } from './helpers';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  const frames = manualScheduler();
  startEvaluation(app, frames.schedule);
  let ui!: UiActions;
  render(
    <AppProvider app={app}>
      <Workbench />
      <UiProbe onReady={(u) => (ui = u)} />
    </AppProvider>,
  );
  const flush = () => act(() => frames.flushFrames());
  const graph = () => tabGraph(app.store.getState(), activeTab(app.store.getState()))!;
  const add = (type: string, values: Record<string, number> = {}) => {
    let id = '';
    act(() => {
      const r = actions.addNode(type, { x: 0, y: 0 });
      if (!r.ok) throw new Error(r.message);
      id = r.id;
      for (const [k, v] of Object.entries(values)) actions.setInputValue(id, k, v);
    });
    return id;
  };
  const select = (...ids: string[]) => act(() => ui.setSelection(ids));
  return { app, actions, flush, graph, add, select };
}

/** «Число 2» и «Число 3» → «Сложить». */
function sumGraph() {
  const h = setup();
  const n1 = h.add('builtin:number', { value: 2 });
  const n2 = h.add('builtin:number', { value: 3 });
  const sum = h.add('builtin:add');
  act(() => {
    h.actions.connect({ node: n1, port: 'value' }, { node: sum, port: 'a' });
    h.actions.connect({ node: n2, port: 'value' }, { node: sum, port: 'b' });
  });
  h.flush();
  return { ...h, n1, n2, sum };
}

const grid = () => screen.getByRole('dialog', { name: 'Свойства' });
const row = (side: 'in' | 'out', port: string) =>
  grid().querySelector<HTMLElement>(`li.prop-row[data-side="${side}"][data-port="${port}"]`)!;

describe('окно свойств (US3)', () => {
  it('#1: имя, тип, панели «Входы» и «Выходы», строки [маркер][тип][имя][значение]', () => {
    const { sum, select } = sumGraph();
    select(sum);
    expect(within(grid()).getByTestId('prop-grid-name')).toHaveTextContent('Сложить');
    expect(within(grid()).getByTestId('prop-grid-type')).toHaveTextContent('Сложить');
    const inputs = within(grid()).getByRole('region', { name: 'Входы' });
    const outputs = within(grid()).getByRole('region', { name: 'Выходы' });
    expect(
      [...inputs.querySelectorAll('li.prop-row')].map((li) => li.getAttribute('data-port')),
    ).toEqual(['a', 'b']);
    expect(
      [...outputs.querySelectorAll('li.prop-row')].map((li) => li.getAttribute('data-port')),
    ).toEqual(['result']);

    const a = row('in', 'a');
    const parts = [...a.children].map((el) => el.className.split(' ')[0]);
    expect(parts).toEqual(['prop-marker', 'prop-type', 'prop-name', 'prop-value']);
    expect(within(a).getByRole('button', { name: 'Связать «a»' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(a.querySelector('.prop-type')).toHaveTextContent('num');
    expect(a.querySelector('.prop-type')).toHaveAttribute('title', 'число');
    expect(a.querySelector('.prop-name')).toHaveTextContent('a');
    expect(row('out', 'result').querySelector('.prop-value')).toHaveTextContent('5');
  });

  it('FR-013b: сокращения типов num, str, bool, arr, obj, any', () => {
    const h = setup();
    const ids = ['builtin:number', 'builtin:text', 'builtin:boolean', 'builtin:json'].map((t) =>
      h.add(t),
    );
    const abbr = (id: string) => {
      h.select(id);
      return row('out', 'value').querySelector('.prop-type')!.textContent;
    };
    expect(ids.map(abbr)).toEqual(['num', 'str', 'bool', 'any']);
    const arr = h.add('builtin:array-length');
    h.select(arr);
    expect(grid().querySelector('li.prop-row[data-side="in"] .prop-type')).toHaveTextContent('arr');
    const obj = h.add('builtin:object-set');
    h.select(obj);
    expect(row('out', 'object').querySelector('.prop-type')).toHaveTextContent('obj');
  });

  it('FR-013a, SC-009: маркер зелёный (.is-linked), если у порта есть связь', () => {
    const { n1, sum, select } = sumGraph();
    select(sum);
    expect(row('in', 'a').querySelector('.prop-marker')).toHaveClass('is-linked');
    expect(row('in', 'b').querySelector('.prop-marker')).toHaveClass('is-linked');
    expect(row('out', 'result').querySelector('.prop-marker')).not.toHaveClass('is-linked');
    select(n1);
    expect(row('out', 'value').querySelector('.prop-marker')).toHaveClass('is-linked');
    expect(row('in', 'value').querySelector('.prop-marker')).not.toHaveClass('is-linked');
  });

  it('#2: значения обновляются при пересчёте без повторного выделения', () => {
    const { actions, n1, sum, select, flush } = sumGraph();
    select(sum);
    act(() => actions.setInputValue(n1, 'value', 10));
    flush();
    expect(row('out', 'result').querySelector('.prop-value')).toHaveTextContent('13');
  });

  it('#3: у неподключённого входа — поле ввода; ввод пересчитывает граф', () => {
    const { n1, sum, select, flush, graph } = sumGraph();
    select(n1);
    fireEvent.change(within(row('in', 'value')).getByLabelText('value'), {
      target: { value: '7' },
    });
    flush();
    expect(graph().nodes.find((n) => n.id === n1)!.values.value).toBe(7);
    select(sum);
    expect(row('out', 'result').querySelector('.prop-value')).toHaveTextContent('10');
  });

  it('#4: у подключённого входа — значение и источник, без поля ввода', () => {
    const { sum, select } = sumGraph();
    select(sum);
    const a = row('in', 'a');
    expect(within(a).queryByRole('textbox')).toBeNull();
    expect(a.querySelector('.prop-value')).toHaveTextContent('2');
    expect(a.querySelector('.prop-source')).toHaveTextContent('← Число.value');
  });

  it('FR-007a: большое значение — компактно, раскрывается по щелчку', () => {
    const h = setup();
    const j = h.add('builtin:json');
    act(() => {
      h.actions.setInputValue(
        j,
        'value',
        Array.from({ length: 50 }, (_, i) => i),
      );
    });
    h.flush();
    h.select(j);
    const out = row('out', 'value').querySelector<HTMLElement>('.value-view')!;
    expect(out).toHaveTextContent('[50 элементов]');
    fireEvent.click(within(out).getByRole('button', { name: 'показать' }));
    expect(out.querySelector('pre')).toHaveTextContent('49');
  });

  it('#5: пустая панель — «Нет выходов»', () => {
    const h = setup();
    h.select(h.add('builtin:show'));
    expect(within(grid()).getByRole('region', { name: 'Выходы' })).toHaveTextContent('Нет выходов');
  });

  it('#7: при нескольких выделенных нодах окна нет', () => {
    const { n1, n2, select } = sumGraph();
    select(n1, n2);
    expect(screen.queryByRole('dialog', { name: 'Свойства' })).toBeNull();
    select();
    expect(screen.queryByRole('dialog', { name: 'Свойства' })).toBeNull();
  });

  it('#6: «Закрыть» скрывает окно и снимает выделение', () => {
    const { sum, select } = sumGraph();
    select(sum);
    fireEvent.click(within(grid()).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog', { name: 'Свойства' })).toBeNull();
    expect(document.querySelector('.react-flow__node.selected')).toBeNull();
  });

  it('#8: у экземпляра составного нода — «Открыть» и «Развернуть»; у нода «Вход» — редактор портов', () => {
    const h = setup();
    const n = h.add('builtin:number', { value: 1 });
    act(() => {
      h.actions.collapseSelection([n], 'Мой составной');
    });
    const inst = h.graph().nodes[0]!;
    h.select(inst.id);
    fireEvent.click(within(grid()).getByRole('button', { name: 'Развернуть «Мой составной»' }));
    expect(h.graph().nodes.map((x) => x.type)).toEqual(['builtin:number']);
    act(() => {
      h.actions.collapseSelection([h.graph().nodes[0]!.id], 'Мой составной 2');
    });
    h.select(h.graph().nodes[0]!.id);
    fireEvent.click(
      within(grid()).getByRole('button', { name: 'Открыть составной нод «Мой составной 2»' }),
    );
    const io = h.add('builtin:input');
    h.select(io);
    expect(within(grid()).getByRole('region', { name: 'Входы' })).toHaveTextContent('Нет входов');
    expect(within(grid()).getAllByLabelText('Имя порта').length).toBeGreaterThan(0);
  });

  it('#9: у нода в ожидании входов — состояние и понятный текст проблемы', () => {
    const h = setup();
    const sum = h.add('builtin:add', { b: 1 });
    h.flush();
    h.select(sum);
    expect(within(grid()).getByTestId('node-status')).toHaveTextContent('ожидает входов');
    expect(within(grid()).getByTestId('node-message')).toHaveTextContent('a');
  });
});

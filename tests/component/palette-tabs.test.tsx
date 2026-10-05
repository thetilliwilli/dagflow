// Палитра — плавающее окно с вкладками категорий (US1 #3–#5, FR-005, FR-006)
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { categories, COMPOSITE_CATEGORY } from '../../src/engine';
import { createActions } from '../../src/store/actions';
import { AppProvider } from '../../src/store/react';
import { activeTab, tabGraph } from '../../src/store/store';
import { NODE_DRAG_TYPE } from '../../src/ui/canvas/Canvas';
import { Workbench } from '../../src/ui/Workbench';
import { testStore } from './helpers';

const IO_CATEGORY = 'Интерфейс составного нода';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  render(
    <AppProvider app={app}>
      <Workbench />
    </AppProvider>,
  );
  const graph = () => tabGraph(app.store.getState(), activeTab(app.store.getState()))!;
  return { app, actions, graph };
}

const space = () => fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
const palette = () => screen.getByRole('dialog', { name: 'Палитра' });
const tabs = () => within(palette()).getByRole('tablist', { name: 'Категории' });
const tabNames = () =>
  within(tabs())
    .getAllByRole('tab')
    .map((t) => t.textContent);
const titles = () =>
  [...palette().querySelectorAll('.palette__item-title')].map((el) => el.textContent);

describe('палитра (US1)', () => {
  it('по умолчанию закрыта; Пробел открывает её плавающим окном (US1 #3)', () => {
    setup();
    expect(screen.queryByRole('dialog', { name: 'Палитра' })).toBeNull();
    space();
    expect(palette()).toHaveAttribute('data-testid', 'palette');
  });

  it('вкладки — категории движка в их порядке и «Мои составные ноды»', () => {
    setup();
    space();
    expect(tabNames()).toEqual([...Object.values(categories), COMPOSITE_CATEGORY]);
    expect(tabNames()).not.toContain(IO_CATEGORY);
  });

  it('вкладка показывает только свои ноды с описанием и строкой портов (US1 #4)', () => {
    setup();
    space();
    fireEvent.click(within(tabs()).getByRole('tab', { name: 'Арифметика' }));
    expect(within(tabs()).getByRole('tab', { name: 'Арифметика' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(titles()).toEqual(['Сложить', 'Вычесть', 'Умножить', 'Разделить']);
    const add = within(palette()).getByText('Сложить').closest('.palette__item') as HTMLElement;
    expect(within(add).getByText('a, b → result')).toBeInTheDocument();
    expect(add.querySelector('.palette__item-desc')!.textContent).not.toBe('');
  });

  it('щелчок по ноду добавляет его, палитра остаётся открытой (US1 #5, FR-006)', () => {
    const { graph } = setup();
    space();
    fireEvent.click(within(tabs()).getByRole('tab', { name: 'Арифметика' }));
    fireEvent.click(within(palette()).getByText('Сложить'));
    expect(graph().nodes.map((n) => n.type)).toEqual(['builtin:add']);
    expect(graph().nodes[0]!.name).toBe('Сложить');
    expect(palette()).toBeInTheDocument();
  });

  it('элемент можно перетащить на холст: в dataTransfer — тип нода', () => {
    setup();
    space();
    const data: Record<string, string> = {};
    const dataTransfer = { setData: (k: string, v: string) => (data[k] = v), effectAllowed: '' };
    fireEvent.dragStart(within(palette()).getByText('Число').closest('.palette__item')!, {
      dataTransfer,
    });
    expect(data[NODE_DRAG_TYPE]).toBe('builtin:number');
  });

  it('выбранная вкладка запоминается после закрытия и открытия', () => {
    setup();
    space();
    fireEvent.click(within(tabs()).getByRole('tab', { name: 'Текст' }));
    space();
    expect(screen.queryByRole('dialog', { name: 'Палитра' })).toBeNull();
    space();
    expect(within(tabs()).getByRole('tab', { name: 'Текст' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('вкладка «Интерфейс составного нода» — только во вкладке составного нода', () => {
    const { actions, graph } = setup();
    let id = '';
    act(() => {
      const r = actions.addNode('builtin:number', { x: 0, y: 0 });
      if (r.ok) id = r.id;
    });
    act(() => {
      actions.collapseSelection([id], 'Мой составной');
    });
    const instance = graph().nodes[0]!;
    act(() => actions.openComposite(instance.type.slice('composite:'.length)));
    space();
    expect(tabNames()).toContain(IO_CATEGORY);
    fireEvent.click(within(tabs()).getByRole('tab', { name: COMPOSITE_CATEGORY }));
    expect(titles()).toContain('Мой составной');
  });

  it('кнопка «Закрыть» закрывает палитру', () => {
    setup();
    space();
    fireEvent.click(within(palette()).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog', { name: 'Палитра' })).toBeNull();
  });
});

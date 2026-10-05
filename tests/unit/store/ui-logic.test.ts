// Стор интерфейса: окна, z-порядок, выделение, Escape, сброс (data-model UiState, FR-002, FR-003, FR-012)
import { describe, expect, it } from 'vitest';
import {
  closeWindow,
  escape,
  focusWindow,
  initialUiState,
  openEdgeWindow,
  openWindow,
  propertiesNodeId,
  pruneMissing,
  resetForTab,
  setPaletteCategory,
  setSelection,
  setWindowPosition,
  toggleWindow,
  type UiState,
} from '../../../src/store/ui-logic';
import type { Graph } from '../../../src/engine';

const graphOf = (nodes: string[], edges: Array<[string, string]> = []): Graph => ({
  nodes: nodes.map((id) => ({
    id,
    type: 'builtin:number',
    name: id,
    position: { x: 0, y: 0 },
    values: {},
  })),
  edges: edges.map(([s, t], i) => ({
    id: `e${i}`,
    source: { node: s, port: 'value' },
    target: { node: t, port: 'a' },
  })),
});

describe('окна', () => {
  it('изначально всё закрыто, положения по умолчанию', () => {
    const s = initialUiState();
    expect(s.windowOrder).toEqual([]);
    expect(s.windows.sidebar).toEqual({ open: false, position: null });
    expect(s.windows.palette).toEqual({ open: false, position: null });
    expect(s.selection).toEqual([]);
    expect(s.linking).toEqual({ kind: 'idle' });
    expect(s.edgeWindow).toBeNull();
  });

  it('open/close/toggle', () => {
    let s = openWindow(initialUiState(), 'sidebar');
    expect(s.windows.sidebar.open).toBe(true);
    expect(s.windowOrder).toEqual(['sidebar']);
    s = toggleWindow(s, 'sidebar');
    expect(s.windows.sidebar.open).toBe(false);
    expect(s.windowOrder).toEqual([]);
    s = toggleWindow(s, 'palette');
    expect(s.windows.palette.open).toBe(true);
    s = closeWindow(s, 'palette');
    expect(s.windows.palette.open).toBe(false);
  });

  it('открытие и focusWindow поднимают окно наверх (в конец windowOrder)', () => {
    let s = openWindow(openWindow(initialUiState(), 'sidebar'), 'palette');
    expect(s.windowOrder).toEqual(['sidebar', 'palette']);
    s = focusWindow(s, 'sidebar');
    expect(s.windowOrder).toEqual(['palette', 'sidebar']);
    s = openWindow(s, 'palette');
    expect(s.windowOrder).toEqual(['sidebar', 'palette']);
  });

  it('focusWindow закрытого окна ничего не меняет', () => {
    const s = openWindow(initialUiState(), 'sidebar');
    expect(focusWindow(s, 'palette')).toBe(s);
  });

  it('setWindowPosition запоминает положение и после закрытия', () => {
    let s = setWindowPosition(openWindow(initialUiState(), 'palette'), 'palette', { x: 10, y: 20 });
    s = openWindow(closeWindow(s, 'palette'), 'palette');
    expect(s.windows.palette.position).toEqual({ x: 10, y: 20 });
  });

  it('вкладка палитры запоминается', () => {
    expect(setPaletteCategory(initialUiState(), 'Арифметика').paletteCategory).toBe('Арифметика');
  });
});

describe('выделение и окно свойств (FR-012)', () => {
  it('окно свойств только при одном выделенном ноде', () => {
    let s = setSelection(initialUiState(), ['A']);
    expect(propertiesNodeId(s)).toBe('A');
    expect(s.windows.properties.open).toBe(true);
    expect(s.windowOrder.at(-1)).toBe('properties');
    s = setSelection(s, ['A', 'B']);
    expect(propertiesNodeId(s)).toBeNull();
    expect(s.windows.properties.open).toBe(false);
    expect(s.windowOrder).not.toContain('properties');
    s = setSelection(s, []);
    expect(propertiesNodeId(s)).toBeNull();
  });

  it('выделение другого нода оставляет окно на своём месте', () => {
    let s = setSelection(initialUiState(), ['A']);
    s = setWindowPosition(s, 'properties', { x: 5, y: 6 });
    s = setSelection(s, ['B']);
    expect(propertiesNodeId(s)).toBe('B');
    expect(s.windows.properties.position).toEqual({ x: 5, y: 6 });
  });

  it('то же выделение возвращает тот же объект (без лишних перерисовок)', () => {
    const s = setSelection(initialUiState(), ['A']);
    expect(setSelection(s, ['A'])).toBe(s);
  });

  it('закрытие окна свойств снимает выделение (US3 #6)', () => {
    const s = closeWindow(setSelection(initialUiState(), ['A']), 'properties');
    expect(s.selection).toEqual([]);
    expect(propertiesNodeId(s)).toBeNull();
  });
});

describe('Escape (FR-003)', () => {
  it('закрывает верхнее окно — последнее открытое или поднятое щелчком', () => {
    let s = openWindow(openWindow(initialUiState(), 'sidebar'), 'palette');
    s = escape(s);
    expect(s.windows.palette.open).toBe(false);
    expect(s.windows.sidebar.open).toBe(true);
    s = openWindow(s, 'palette');
    s = focusWindow(s, 'sidebar');
    s = escape(s);
    expect(s.windows.sidebar.open).toBe(false);
    expect(s.windows.palette.open).toBe(true);
  });

  it('для окна свойств — снимает выделение', () => {
    const s = escape(setSelection(initialUiState(), ['A']));
    expect(s.selection).toEqual([]);
  });

  it('для окна связей — закрывает его', () => {
    const s = escape(openEdgeWindow(initialUiState(), 'A', 'B', { x: 1, y: 2 }));
    expect(s.edgeWindow).toBeNull();
    expect(s.windowOrder).toEqual([]);
  });

  it('без открытых окон ничего не меняет', () => {
    const s = initialUiState();
    expect(escape(s)).toBe(s);
  });
});

describe('окно связей', () => {
  it('открывается поверх остальных с парой и точкой щелчка', () => {
    const s = openEdgeWindow(openWindow(initialUiState(), 'palette'), 'A', 'B', { x: 1, y: 2 });
    expect(s.edgeWindow).toEqual({ source: 'A', target: 'B', at: { x: 1, y: 2 } });
    expect(s.windowOrder).toEqual(['palette', 'edges']);
  });

  it('closeWindow(edges) очищает пару', () => {
    expect(
      closeWindow(openEdgeWindow(initialUiState(), 'A', 'B', { x: 0, y: 0 }), 'edges').edgeWindow,
    ).toBeNull();
  });
});

describe('сброс и удалённые ноды', () => {
  it('resetForTab очищает выделение, окно связей и связывание, другие окна не трогает', () => {
    let s: UiState = openWindow(initialUiState(), 'palette');
    s = openEdgeWindow(setSelection(s, ['A']), 'A', 'B', { x: 0, y: 0 });
    s = resetForTab(s);
    expect(s.selection).toEqual([]);
    expect(s.edgeWindow).toBeNull();
    expect(s.linking).toEqual({ kind: 'idle' });
    expect(s.windows.properties.open).toBe(false);
    expect(s.windows.palette.open).toBe(true);
    expect(s.windowOrder).toEqual(['palette']);
  });

  it('pruneMissing убирает удалённые ноды из выделения', () => {
    const s = pruneMissing(setSelection(initialUiState(), ['A']), graphOf(['B']));
    expect(s.selection).toEqual([]);
    expect(s.windows.properties.open).toBe(false);
  });

  it('pruneMissing закрывает окно связей, если в паре не осталось связей', () => {
    const open = openEdgeWindow(initialUiState(), 'A', 'B', { x: 0, y: 0 });
    expect(pruneMissing(open, graphOf(['A', 'B'], [['A', 'B']])).edgeWindow).not.toBeNull();
    expect(pruneMissing(open, graphOf(['A', 'B'])).edgeWindow).toBeNull();
  });

  it('pruneMissing без изменений возвращает тот же объект', () => {
    const s = setSelection(initialUiState(), ['A']);
    expect(pruneMissing(s, graphOf(['A']))).toBe(s);
  });
});

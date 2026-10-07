// Стор интерфейса: окна, z-порядок, выделение, Escape, сброс (data-model UiState, FR-002, FR-003, FR-012)
import { describe, expect, it } from 'vitest';
import {
  cancelLinking,
  closeWindow,
  linkTo,
  movePointer,
  pressLink,
  releasePointer,
  setPeek,
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
  setStorageHint,
  setWindowPosition,
  toggleWindow,
  type UiState,
} from '../../../src/store/ui-logic';
import type { Graph } from '@dagflow/engine';

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

  it('этап подсказки о хранилище: hint → reminder → hidden, переживает закрытие панели', () => {
    let s = initialUiState();
    expect(s.storageHint).toBe('hint');
    s = setStorageHint(s, 'reminder');
    s = openWindow(closeWindow(openWindow(s, 'sidebar'), 'sidebar'), 'sidebar');
    expect(s.storageHint).toBe('reminder');
    expect(setStorageHint(s, 'hidden').storageHint).toBe('hidden');
  });

  it('вкладка палитры запоминается', () => {
    expect(setPaletteCategory(initialUiState(), 'Math').paletteCategory).toBe('Math');
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

describe('машина связывания (US4, research R5)', () => {
  const A = { node: 'A', port: 'value', side: 'out' as const };
  const B_a = { node: 'B', port: 'a', side: 'in' as const };
  const ok = { ok: true as const };
  const bad = { ok: false as const, message: 'Incompatible types: text → number.' };
  const picking = () => releasePointer(pressLink(initialUiState(), A, { x: 0, y: 0 }, true));
  const dragging = () =>
    movePointer(pressLink(initialUiState(), A, { x: 0, y: 0 }, false), { x: 10, y: 0 });

  it('нажатие на строку — pressed', () => {
    expect(pressLink(initialUiState(), A, { x: 5, y: 5 }, true).linking).toMatchObject({
      kind: 'pressed',
      from: A,
    });
  });

  it('сдвиг больше 4 px — перетаскивание; меньше — ещё нажатие', () => {
    const p = pressLink(initialUiState(), A, { x: 0, y: 0 }, false);
    expect(movePointer(p, { x: 2, y: 2 }).linking.kind).toBe('pressed');
    const d = movePointer(p, { x: 5, y: 0 });
    expect(d.linking).toEqual({ kind: 'dragging', from: A, pointer: { x: 5, y: 0 }, peek: null });
    expect(movePointer(d, { x: 40, y: 7 }).linking).toMatchObject({ pointer: { x: 40, y: 7 } });
  });

  it('отпускание без сдвига: на маркере — режим привязки (US4 #9), на имени — ничего', () => {
    expect(picking().linking).toEqual({ kind: 'picking', from: A, peek: null });
    expect(releasePointer(pressLink(initialUiState(), A, { x: 0, y: 0 }, false)).linking).toEqual({
      kind: 'idle',
    });
  });

  it('наведение на нод задаёт и переключает временное окно (US4 #8, #10)', () => {
    let s = setPeek(dragging(), 'B');
    expect(s.linking).toMatchObject({ peek: 'B' });
    s = setPeek(s, 'C');
    expect(s.linking).toMatchObject({ peek: 'C' });
    expect(setPeek(picking(), 'B').linking).toMatchObject({ kind: 'picking', peek: 'B' });
    expect(setPeek(initialUiState(), 'B').linking).toEqual({ kind: 'idle' });
  });

  it('бросок или щелчок на доступной строке — намерение connect и конец связывания (US4 #3, #10)', () => {
    for (const start of [dragging(), picking()]) {
      const r = linkTo(setPeek(start, 'B'), B_a, ok);
      expect(r.intent).toEqual({ kind: 'connect', from: A, to: B_a });
      expect(r.state.linking).toEqual({ kind: 'idle' });
    }
  });

  it('на недоступной строке — сообщение; перетаскивание кончается, режим привязки — нет (US4 #5, #11)', () => {
    const d = linkTo(dragging(), B_a, bad);
    expect(d.intent).toEqual({ kind: 'notify', message: 'Incompatible types: text → number.' });
    expect(d.state.linking).toEqual({ kind: 'idle' });
    const p = linkTo(setPeek(picking(), 'B'), B_a, bad);
    expect(p.intent).toEqual({ kind: 'notify', message: 'Incompatible types: text → number.' });
    expect(p.state.linking).toMatchObject({ kind: 'picking', peek: 'B' });
  });

  it('вне связывания linkTo ничего не делает', () => {
    const s = initialUiState();
    expect(linkTo(s, B_a, ok)).toEqual({ state: s, intent: null });
  });

  it('отмена: cancelLinking, Escape, повторный щелчок по тому же маркеру (US4 #6, #12)', () => {
    expect(cancelLinking(dragging()).linking).toEqual({ kind: 'idle' });
    expect(cancelLinking(picking()).linking).toEqual({ kind: 'idle' });
    // Escape сначала отменяет связывание и не закрывает окна
    const withWindow = { ...openWindow(picking(), 'palette') };
    const e = escape(withWindow);
    expect(e.linking).toEqual({ kind: 'idle' });
    expect(e.windows.palette.open).toBe(true);
    const again = releasePointer(pressLink(picking(), A, { x: 0, y: 0 }, true));
    expect(again.linking).toEqual({ kind: 'idle' });
  });

  it('в режиме привязки начать перетаскивание другого параметра — перетаскивание', () => {
    const other = { node: 'A', port: 'x', side: 'in' as const };
    const s = movePointer(pressLink(picking(), other, { x: 0, y: 0 }, false), { x: 20, y: 0 });
    expect(s.linking).toMatchObject({ kind: 'dragging', from: other });
  });

  it('смена вкладки и удаление нода-источника завершают связывание', () => {
    expect(resetForTab(picking()).linking).toEqual({ kind: 'idle' });
    expect(pruneMissing(picking(), graphOf(['B'])).linking).toEqual({ kind: 'idle' });
    expect(pruneMissing(picking(), graphOf(['A', 'B'])).linking.kind).toBe('picking');
  });
});

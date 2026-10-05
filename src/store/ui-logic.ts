// Состояние интерфейса и чистые переходы: окна, z-порядок, выделение, Escape
// (specs/002-editor-ui-redesign/data-model.md «UiState», research R4, R6)
import type { Graph } from '../engine';

export type WindowId = 'sidebar' | 'palette' | 'properties' | 'edges';

export interface Point {
  x: number;
  y: number;
}

export interface WindowState {
  open: boolean;
  /** null — положение по умолчанию (research R6). */
  position: Point | null;
}

/** Связывание параметров (US4). Переходы появятся вместе с историей US4. */
export type LinkingState = { kind: 'idle' };

export interface EdgeWindow {
  source: string;
  target: string;
  /** Где щёлкнули по линии — окно связей открывается рядом. */
  at: Point;
}

export interface UiState {
  /** Выделенные ноды активной вкладки. */
  selection: string[];
  windows: Record<WindowId, WindowState>;
  /** Открытые окна снизу вверх: последнее — верхнее. */
  windowOrder: WindowId[];
  paletteCategory: string | null;
  edgeWindow: EdgeWindow | null;
  linking: LinkingState;
}

const IDLE: LinkingState = { kind: 'idle' };

export function initialUiState(): UiState {
  const closed = (): WindowState => ({ open: false, position: null });
  return {
    selection: [],
    windows: { sidebar: closed(), palette: closed(), properties: closed(), edges: closed() },
    windowOrder: [],
    paletteCategory: null,
    edgeWindow: null,
    linking: IDLE,
  };
}

function withWindow(s: UiState, id: WindowId, open: boolean): UiState {
  const order = s.windowOrder.filter((w) => w !== id);
  return {
    ...s,
    windows: { ...s.windows, [id]: { ...s.windows[id], open } },
    windowOrder: open ? [...order, id] : order,
  };
}

/** Открыть окно и поднять его наверх. */
export function openWindow(s: UiState, id: WindowId): UiState {
  return withWindow(s, id, true);
}

/** Закрыть окно; окно свойств при этом снимает выделение, окно связей забывает пару. */
export function closeWindow(s: UiState, id: WindowId): UiState {
  if (id === 'properties') return setSelection(s, []);
  const next = withWindow(s, id, false);
  return id === 'edges' ? { ...next, edgeWindow: null } : next;
}

export function toggleWindow(s: UiState, id: WindowId): UiState {
  return s.windows[id].open ? closeWindow(s, id) : openWindow(s, id);
}

/** Щелчок по окну поднимает его наверх. */
export function focusWindow(s: UiState, id: WindowId): UiState {
  if (!s.windows[id].open || s.windowOrder.at(-1) === id) return s;
  return withWindow(s, id, true);
}

export function setWindowPosition(s: UiState, id: WindowId, position: Point): UiState {
  return { ...s, windows: { ...s.windows, [id]: { ...s.windows[id], position } } };
}

export function setPaletteCategory(s: UiState, category: string): UiState {
  return { ...s, paletteCategory: category };
}

/** Новое выделение; окно свойств открыто, только пока выделен ровно один нод (FR-012). */
export function setSelection(s: UiState, selection: string[]): UiState {
  const same =
    selection.length === s.selection.length && selection.every((id, i) => id === s.selection[i]);
  if (same) return s;
  const single = selection.length === 1;
  const next = { ...s, selection };
  if (single && s.selection.length === 1) return next; // другой нод — окно остаётся где было
  return withWindow(next, 'properties', single);
}

/** Нод, свойства которого показывает окно свойств. */
export function propertiesNodeId(s: UiState): string | null {
  return s.selection.length === 1 ? s.selection[0]! : null;
}

export function openEdgeWindow(s: UiState, source: string, target: string, at: Point): UiState {
  return { ...openWindow(s, 'edges'), edgeWindow: { source, target, at } };
}

/** Escape закрывает верхнее окно (FR-003). Связывание добавит свой приоритет в US4. */
export function escape(s: UiState): UiState {
  const top = s.windowOrder.at(-1);
  return top ? closeWindow(s, top) : s;
}

/** Смена вкладки: выделение, окно связей и связывание относятся к прежней вкладке. */
export function resetForTab(s: UiState): UiState {
  const next = closeWindow(setSelection(s, []), 'edges');
  return { ...next, linking: IDLE };
}

/** Граф изменился: убрать удалённые ноды из выделения и закрыть окно связей без связей. */
export function pruneMissing(s: UiState, graph: Graph): UiState {
  const ids = new Set(graph.nodes.map((n) => n.id));
  let next = s;
  if (s.selection.some((id) => !ids.has(id)))
    next = setSelection(
      next,
      s.selection.filter((id) => ids.has(id)),
    );
  const w = next.edgeWindow;
  if (w && !graph.edges.some((e) => e.source.node === w.source && e.target.node === w.target)) {
    next = closeWindow(next, 'edges');
  }
  return next;
}

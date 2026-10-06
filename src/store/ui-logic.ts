// Состояние интерфейса и чистые переходы: окна, z-порядок, выделение, Escape
// (specs/002-editor-ui-redesign/data-model.md «UiState», research R4, R6)
import type { Graph, LinkEnd } from '../engine';

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

/**
 * Связывание параметров (US4, research R5):
 * idle → pressed (нажатие на маркер или имя строки) → dragging (сдвиг > 4 px)
 *                                                  → picking (отпускание на маркере)
 * dragging / picking: peek — нод, чьё временное окно показано.
 */
export type LinkingState =
  | { kind: 'idle' }
  | {
      kind: 'pressed';
      from: LinkEnd;
      start: Point;
      onMarker: boolean;
      /** Нажали маркер того же параметра в режиме привязки — отпускание завершит режим. */
      cancelsPicking: boolean;
    }
  | { kind: 'dragging'; from: LinkEnd; pointer: Point; peek: string | null }
  | { kind: 'picking'; from: LinkEnd; peek: string | null };

/** Что сделать после броска или щелчка по строке временного окна. */
export type LinkIntent =
  { kind: 'connect'; from: LinkEnd; to: LinkEnd } | { kind: 'notify'; message: string } | null;

/** Порог сдвига, после которого нажатие становится перетаскиванием. */
export const DRAG_THRESHOLD = 4;

/** Этап подсказки о хранилище: подсказка о папке → напоминание о выгрузке → скрыто (FR-006a). */
export type StorageHint = 'hint' | 'reminder' | 'hidden';

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
  /** Живёт в сторе, а не в компоненте: левую панель можно закрыть и открыть без потери этапа. */
  storageHint: StorageHint;
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
    storageHint: 'hint',
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

export function setStorageHint(s: UiState, storageHint: StorageHint): UiState {
  return { ...s, storageHint };
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

/** Escape: сначала отменяет связывание, иначе закрывает верхнее окно (FR-003, FR-021). */
export function escape(s: UiState): UiState {
  if (s.linking.kind !== 'idle') return cancelLinking(s);
  const top = s.windowOrder.at(-1);
  return top ? closeWindow(s, top) : s;
}

const sameEnd = (a: LinkEnd, b: LinkEnd) =>
  a.node === b.node && a.port === b.port && a.side === b.side;

/** Нажатие на маркер или имя строки окна свойств. */
export function pressLink(s: UiState, from: LinkEnd, at: Point, onMarker: boolean): UiState {
  const cancelsPicking = s.linking.kind === 'picking' && onMarker && sameEnd(s.linking.from, from);
  return { ...s, linking: { kind: 'pressed', from, start: at, onMarker, cancelsPicking } };
}

/** Движение указателя: нажатие становится перетаскиванием, у перетаскивания меняется точка. */
export function movePointer(s: UiState, at: Point): UiState {
  const l = s.linking;
  if (l.kind === 'pressed') {
    const moved = Math.hypot(at.x - l.start.x, at.y - l.start.y) > DRAG_THRESHOLD;
    return moved
      ? { ...s, linking: { kind: 'dragging', from: l.from, pointer: at, peek: null } }
      : s;
  }
  if (l.kind === 'dragging') return { ...s, linking: { ...l, pointer: at } };
  return s;
}

/** Отпускание без сдвига: на маркере — режим привязки (FR-018a), иначе ничего. */
export function releasePointer(s: UiState): UiState {
  const l = s.linking;
  if (l.kind !== 'pressed') return s;
  if (l.onMarker && !l.cancelsPicking)
    return { ...s, linking: { kind: 'picking', from: l.from, peek: null } };
  return { ...s, linking: IDLE };
}

/** Курсор над нодом (или щелчок по нему в режиме привязки) — показать его временное окно. */
export function setPeek(s: UiState, peek: string | null): UiState {
  const l = s.linking;
  if ((l.kind !== 'dragging' && l.kind !== 'picking') || l.peek === peek) return s;
  return { ...s, linking: { ...l, peek } };
}

/**
 * Бросок или щелчок по строке временного окна. check — доступна ли строка (linkCandidates).
 * Доступна — связать; нет — объяснить: перетаскивание кончается, режим привязки продолжается.
 */
export function linkTo(
  s: UiState,
  to: LinkEnd,
  check: { ok: true } | { ok: false; message: string },
): { state: UiState; intent: LinkIntent } {
  const l = s.linking;
  if (l.kind !== 'dragging' && l.kind !== 'picking') return { state: s, intent: null };
  if (check.ok)
    return { state: { ...s, linking: IDLE }, intent: { kind: 'connect', from: l.from, to } };
  const state = l.kind === 'dragging' ? { ...s, linking: IDLE } : s;
  return { state, intent: { kind: 'notify', message: check.message } };
}

export function cancelLinking(s: UiState): UiState {
  return s.linking.kind === 'idle' ? s : { ...s, linking: IDLE };
}

/** Параметр, с которого идёт связывание (для подсветки строки и маркера). */
export function linkingFrom(s: UiState): LinkEnd | null {
  return s.linking.kind === 'idle' ? null : s.linking.from;
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
  const l = next.linking;
  if (l.kind !== 'idle' && !ids.has(l.from.node)) next = cancelLinking(next);
  const w = next.edgeWindow;
  if (w && !graph.edges.some((e) => e.source.node === w.source && e.target.node === w.target)) {
    next = closeWindow(next, 'edges');
  }
  return next;
}

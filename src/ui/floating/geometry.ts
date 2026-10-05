// Положение плавающих окон: ограничение окном редактора и места по умолчанию (FR-003, research R6)
import type { Point, WindowId } from '../../store/ui-logic';

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

/** Высота верхней полосы (кнопка меню + вкладки) — окна по умолчанию встают ниже неё. */
export const TOP_BAR_HEIGHT = 40;

const GAP = 8;

/** Сдвинуть окно так, чтобы оно целиком было в окне редактора; большое окно — к левому верхнему углу. */
export function clampToViewport(rect: Rect, viewport: Size): Point {
  return {
    x: Math.max(0, Math.min(rect.x, viewport.width - rect.width)),
    y: Math.max(0, Math.min(rect.y, viewport.height - rect.height)),
  };
}

/** Положение окна, пока пользователь его не передвинул. */
export function defaultPosition(id: WindowId, size: Size, viewport: Size): Point {
  const top = TOP_BAR_HEIGHT + GAP;
  const wanted: Record<WindowId, Point> = {
    sidebar: { x: GAP, y: top },
    // Палитра — полоса внизу по центру, между кнопками масштаба и мини-картой (research R11)
    palette: { x: (viewport.width - size.width) / 2, y: viewport.height - size.height - GAP * 2 },
    properties: { x: viewport.width - size.width - GAP, y: top },
    edges: { x: (viewport.width - size.width) / 2, y: (viewport.height - size.height) / 2 },
  };
  return clampToViewport({ ...wanted[id], ...size }, viewport);
}

/**
 * Временное окно свойств при связывании (FR-018): рядом с нодом, со стороны, где больше места,
 * не перекрывая нод и не выходя за край экрана.
 */
export function peekPosition(node: Rect, size: Size, viewport: Size): Point {
  const right = viewport.width - (node.x + node.width);
  const left = node.x;
  const x = right >= left ? node.x + node.width + GAP : node.x - GAP - size.width;
  return clampToViewport({ x, y: node.y, ...size }, viewport);
}

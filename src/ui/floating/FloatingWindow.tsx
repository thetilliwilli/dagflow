// Плавающее неблокирующее окно: заголовок, «Закрыть», перетаскивание за заголовок (FR-002, FR-003)
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import type { Point } from '../../store/ui-logic';
import { windowMessages } from '../messages';
import { createPortal } from 'react-dom';
import { useFloatingLayer } from './FloatingLayer';
import { clampToViewport, type Size } from './geometry';

export interface FloatingWindowProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Доступное имя окна (`aria-label`). */
  label: string;
  title: ReactNode;
  /** Сохранённое положение; null — встать по `place`. */
  position: Point | null;
  /** Положение по умолчанию по размеру окна и вьюпорту. */
  place?: (size: Size, viewport: Size) => Point;
  onMove?: (position: Point) => void;
  onClose: () => void;
  /** Окно активировали (pointerdown по нему) — поднять наверх. */
  onFocus?: () => void;
  zIndex?: number;
  children: ReactNode;
}

const viewportSize = (): Size => ({ width: window.innerWidth, height: window.innerHeight });

export function FloatingWindow({
  label,
  title,
  position,
  place,
  onMove,
  onClose,
  onFocus,
  zIndex,
  children,
  className,
  ...rest
}: FloatingWindowProps) {
  const layer = useFloatingLayer();
  const ref = useRef<HTMLElement>(null);
  const [placed, setPlaced] = useState<Point | null>(null);
  const [dragPos, setDragPos] = useState<Point | null>(null);
  /** Поправка после изменения размера окна браузера — пока родитель не передал новое положение. */
  const [override, setOverride] = useState<Point | null>(null);
  const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const current = dragPos ?? override ?? position ?? placed ?? { x: 0, y: 0 };

  useEffect(() => setOverride(null), [position]);

  const size = (): Size => ({
    width: ref.current?.offsetWidth ?? 0,
    height: ref.current?.offsetHeight ?? 0,
  });
  const clamp = useCallback((p: Point) => clampToViewport({ ...p, ...size() }, viewportSize()), []);

  // Без сохранённого положения — встать по месту по умолчанию, как только известен размер окна
  useLayoutEffect(() => {
    if (position || placed) return;
    setPlaced(place ? place(size(), viewportSize()) : clamp({ x: 0, y: 0 }));
  }, [position, placed, place, clamp]);

  // Окно браузера уменьшили — вернуть окно внутрь
  useEffect(() => {
    const onResize = () => {
      const from = override ?? position ?? placed;
      if (!from) return;
      const next = clamp(from);
      if (next.x === from.x && next.y === from.y) return;
      if (position) {
        setOverride(next);
        onMove?.(next);
      } else setPlaced(next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [override, position, placed, clamp, onMove]);

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    drag.current = { pointerId: e.pointerId, dx: e.clientX - current.x, dy: e.clientY - current.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setDragPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
  };
  const onHeaderPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    const final = clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy });
    setDragPos(null);
    if (onMove) onMove(final);
    else setPlaced(final);
  };

  const win = (
    <section
      {...rest}
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label={label}
      className={className ? `floating ${className}` : 'floating'}
      style={{ left: `${current.x}px`, top: `${current.y}px`, zIndex }}
      onPointerDownCapture={() => onFocus?.()}
    >
      <header
        className="floating__header"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <span className="floating__title">{title}</span>
        <button
          type="button"
          className="floating__close"
          aria-label={windowMessages.close}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="floating__body">{children}</div>
    </section>
  );
  return layer ? createPortal(win, layer) : win;
}

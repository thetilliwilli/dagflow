// Плавающее окно, связанное со стором интерфейса: положение, z-порядок, закрытие (research R6)
import { useCallback, type ReactNode } from 'react';
import { useUi, useUiActions } from '../../store/ui';
import type { Point, WindowId } from '../../store/ui-logic';
import { FloatingWindow, type FloatingWindowProps } from './FloatingWindow';
import { defaultPosition, type Size } from './geometry';

type Props = Omit<
  FloatingWindowProps,
  'position' | 'place' | 'onMove' | 'onClose' | 'onFocus' | 'zIndex' | 'children'
> & {
  id: WindowId;
  /** По умолчанию — закрыть окно в сторе интерфейса. */
  onClose?: () => void;
  children: ReactNode;
};

export function ManagedWindow({ id, onClose, children, ...rest }: Props) {
  const ui = useUiActions();
  const position = useUi((s) => s.windows[id].position);
  const z = useUi((s) => s.windowOrder.indexOf(id));
  const place = useCallback(
    (size: Size, viewport: Size) => defaultPosition(id, size, viewport),
    [id],
  );
  const onMove = useCallback((p: Point) => ui.setWindowPosition(id, p), [ui, id]);
  return (
    <FloatingWindow
      {...rest}
      position={position}
      place={place}
      onMove={onMove}
      onClose={onClose ?? (() => ui.closeWindow(id))}
      onFocus={() => ui.focusWindow(id)}
      zIndex={z + 1}
    >
      {children}
    </FloatingWindow>
  );
}

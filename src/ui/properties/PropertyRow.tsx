// Строка окна свойств: [маркер] [тип] [имя] [значение] (FR-013, FR-013a, FR-013b).
// В своём окне строка — источник связывания (FR-018, FR-018a), во временном — цель (FR-020).
import type { PointerEvent, ReactNode } from 'react';
import type { PortDef, PortSide } from '@dagflow/engine';
import { propertiesMessages as m, typeAbbr, typeLabels } from '../messages';

interface Props {
  side: PortSide;
  port: PortDef;
  /** У порта есть хотя бы одна связь — маркер зелёный. */
  linked: boolean;
  /** С этого параметра идёт связывание: маркер нажат, строка подсвечена. */
  linking?: boolean;
  /** Во временном окне: связать с этим параметром нельзя (строка серая, но на месте). */
  disabled?: boolean;
  /** Почему нельзя — во всплывающей подсказке. */
  reason?: string;
  /** Нажатие на маркер (onMarker) или имя — начало связывания. */
  onPress?: (e: PointerEvent, onMarker: boolean) => void;
  /** Щелчок по строке временного окна в режиме привязки. */
  onPick?: () => void;
  /** Ячейка значения: поле ввода, значение или значение с источником. */
  children: ReactNode;
}

export function PropertyRow({
  side,
  port,
  linked,
  linking = false,
  disabled,
  reason,
  onPress,
  onPick,
  children,
}: Props) {
  const classes = [
    'prop-row',
    linking && 'is-linking',
    disabled && 'is-disabled',
    onPick && 'is-target',
  ]
    .filter(Boolean)
    .join(' ');
  const press = (onMarker: boolean) => (e: PointerEvent) => {
    if (e.button !== 0 || !onPress) return;
    if (!onMarker) e.preventDefault(); // не выделять текст имени при перетаскивании
    onPress(e, onMarker);
  };
  return (
    <li
      className={classes}
      data-side={side}
      data-port={port.name}
      aria-disabled={disabled === undefined ? undefined : disabled}
      title={reason}
      onClick={onPick}
    >
      <button
        type="button"
        className={`prop-marker ${linked ? 'is-linked' : ''}`}
        aria-label={m.link(port.name)}
        aria-pressed={linking}
        onPointerDown={press(true)}
      />
      <span className="prop-type" title={typeLabels[port.type]}>
        {typeAbbr[port.type]}
      </span>
      <span className="prop-name" title={port.name} onPointerDown={press(false)}>
        {port.name}
      </span>
      <span className="prop-value">{children}</span>
    </li>
  );
}

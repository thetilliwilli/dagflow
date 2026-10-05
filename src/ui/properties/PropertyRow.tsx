// Строка окна свойств: [маркер] [тип] [имя] [значение] (FR-013, FR-013a, FR-013b)
import type { ReactNode } from 'react';
import type { PortDef, PortSide } from '../../engine';
import { propertiesMessages as m, typeAbbr, typeLabels } from '../messages';

interface Props {
  side: PortSide;
  port: PortDef;
  /** У порта есть хотя бы одна связь — маркер зелёный. */
  linked: boolean;
  /** Ячейка значения: поле ввода, значение или значение с источником. */
  children: ReactNode;
}

export function PropertyRow({ side, port, linked, children }: Props) {
  return (
    <li className="prop-row" data-side={side} data-port={port.name}>
      <button
        type="button"
        className={`prop-marker ${linked ? 'is-linked' : ''}`}
        aria-label={m.link(port.name)}
        aria-pressed={false}
      />
      <span className="prop-type" title={typeLabels[port.type]}>
        {typeAbbr[port.type]}
      </span>
      <span className="prop-name" title={port.name}>
        {port.name}
      </span>
      <span className="prop-value">{children}</span>
    </li>
  );
}

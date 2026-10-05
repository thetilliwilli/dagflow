// Порт нода: точка соединения React Flow + подпись «имя: тип»
import { Handle, Position } from '@xyflow/react';
import type { PortDef } from '../../engine';
import { typeLabels } from '../messages';

export const inHandle = (name: string) => `in:${name}`;
export const outHandle = (name: string) => `out:${name}`;
export const portOfHandle = (handle: string | null | undefined) => (handle ?? '').replace(/^(in|out):/, '');

export function PortHandle({ port, kind }: { port: PortDef; kind: 'in' | 'out' }) {
  return (
    <>
      <Handle
        type={kind === 'in' ? 'target' : 'source'}
        position={kind === 'in' ? Position.Left : Position.Right}
        id={kind === 'in' ? inHandle(port.name) : outHandle(port.name)}
        className={`port-handle port-${port.type}`}
      />
      <span className="port-label">
        {port.name}: {typeLabels[port.type]}
      </span>
    </>
  );
}

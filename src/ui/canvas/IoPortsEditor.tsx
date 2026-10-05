// Редактор портов нода «Вход»/«Выход» (FR-021a, FR-021c)
import { useState } from 'react';
import type { PortDef, PortType } from '../../engine';
import { useActions } from '../../store/react';
import { compositeMessages as m, typeLabels } from '../messages';

const TYPES: PortType[] = ['number', 'text', 'boolean', 'array', 'object', 'any'];

export function IoPortsEditor({ nodeId, ports }: { nodeId: string; ports: PortDef[] }) {
  const actions = useActions();
  const [names, setNames] = useState<Record<number, string>>({});

  function commit(next: PortDef[]) {
    const r = actions.editIoPorts(nodeId, next);
    if (!r.ok) actions.notify('error', r.message);
    else setNames({});
  }

  function addPort() {
    const taken = new Set(ports.map((p) => p.name));
    let n = ports.length + 1;
    while (taken.has(`p${n}`)) n += 1;
    commit([...ports, { name: `p${n}`, type: 'any', required: true }]);
  }

  return (
    <div className="io-ports nodrag" aria-label={m.ports}>
      {ports.map((p, i) => (
        <div className="io-ports__row" key={`${i}-${p.name}`}>
          <input
            aria-label={m.portName}
            value={names[i] ?? p.name}
            maxLength={40}
            onChange={(e) => setNames({ ...names, [i]: e.target.value })}
            onBlur={() => names[i] !== undefined && names[i] !== p.name && commit(ports.map((x, j) => (j === i ? { ...x, name: names[i]! } : x)))}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <select aria-label={m.portType} value={p.type} onChange={(e) => commit(ports.map((x, j) => (j === i ? { ...x, type: e.target.value as PortType } : x)))}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </select>
          <button type="button" aria-label={m.removePort(p.name)} onClick={() => commit(ports.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="io-ports__add" onClick={addPort}>
        + {m.addPort}
      </button>
    </div>
  );
}

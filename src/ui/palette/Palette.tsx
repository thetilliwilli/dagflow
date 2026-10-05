// Палитра типов нодов по категориям (FR-001)
import type { DragEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { NodeTypeDef } from '../../engine';
import { useActions, useAppState } from '../../store/react';
import { registryOf } from '../../store/registry';
import { activeTab, tabGraph } from '../../store/store';
import { NODE_DRAG_TYPE } from '../canvas/Canvas';
import { messages, typeLabels } from '../messages';

function portsSummary(def: NodeTypeDef): string {
  const fmt = (ps: NodeTypeDef['inputs']) => ps.map((p) => `${p.name}: ${typeLabels[p.type]}`).join(', ') || '—';
  return `Входы: ${fmt(def.inputs)}. Выходы: ${fmt(def.outputs)}.`;
}

export function Palette() {
  const actions = useActions();
  const registry = useAppState(registryOf);
  const count = useAppState((s) => tabGraph(s, activeTab(s))?.nodes.length ?? 0);
  const { screenToFlowPosition } = useReactFlow();

  const groups = new Map<string, NodeTypeDef[]>();
  for (const def of registry.list()) {
    const list = groups.get(def.category) ?? [];
    list.push(def);
    groups.set(def.category, list);
  }

  function addAtCenter(type: string) {
    const rect = document.querySelector('.react-flow')?.getBoundingClientRect();
    const center = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 } : { x: 0, y: 0 };
    const p = screenToFlowPosition(center);
    const shift = (count % 10) * 24;
    actions.addNode(type, { x: p.x + shift, y: p.y + shift });
  }

  function onDragStart(e: DragEvent, type: string) {
    e.dataTransfer.setData(NODE_DRAG_TYPE, type);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <aside className="palette" data-testid="palette">
      <h2 className="palette__title">{messages.palette}</h2>
      <p className="palette__hint">{messages.paletteHint}</p>
      {[...groups.entries()].map(([category, defs]) => (
        <section key={category} className="palette__group">
          <h3>{category}</h3>
          {defs.map((def) => (
            <div
              key={def.id}
              className="palette__item"
              draggable
              title={portsSummary(def)}
              onDragStart={(e) => onDragStart(e, def.id)}
              onDoubleClick={() => addAtCenter(def.id)}
            >
              <span className="palette__item-title">{def.title}</span>
              <span className="palette__item-desc">{def.description}</span>
            </div>
          ))}
        </section>
      ))}
    </aside>
  );
}

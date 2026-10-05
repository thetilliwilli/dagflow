// Палитра типов нодов по категориям (FR-001)
import { useState, type DragEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import { COMPOSITE_CATEGORY, type NodeTypeDef } from '../../engine';
import { useActions, useAppState } from '../../store/react';
import { registryOf } from '../../store/registry';
import { activeTab, tabGraph } from '../../store/store';
import { NODE_DRAG_TYPE } from '../canvas/Canvas';
import { ConfirmDialog } from '../dialogs/ConfirmDialog';
import { NameDialog } from '../dialogs/NameDialog';
import { compositeMessages, messages, typeLabels, workflowMessages } from '../messages';

function portsSummary(def: NodeTypeDef): string {
  const fmt = (ps: NodeTypeDef['inputs']) => ps.map((p) => `${p.name}: ${typeLabels[p.type]}`).join(', ') || '—';
  return `Входы: ${fmt(def.inputs)}. Выходы: ${fmt(def.outputs)}.`;
}

export function Palette() {
  const actions = useActions();
  const registry = useAppState(registryOf);
  const count = useAppState((s) => tabGraph(s, activeTab(s))?.nodes.length ?? 0);
  const insideComposite = useAppState((s) => activeTab(s)?.kind === 'composite');
  const { screenToFlowPosition } = useReactFlow();
  const [renaming, setRenaming] = useState<NodeTypeDef | null>(null);
  const [deleting, setDeleting] = useState<NodeTypeDef | null>(null);

  const groups = new Map<string, NodeTypeDef[]>();
  for (const def of registry.list()) {
    if (def.paletteScope === 'hidden') continue;
    if (def.paletteScope === 'composite' && !insideComposite) continue;
    const list = groups.get(def.category) ?? [];
    list.push(def);
    groups.set(def.category, list);
  }

  function addAtCenter(type: string) {
    const rect = document.querySelector('.react-flow')?.getBoundingClientRect();
    const center = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 } : { x: 0, y: 0 };
    const p = screenToFlowPosition(center);
    const shift = (count % 10) * 24;
    const r = actions.addNode(type, { x: p.x + shift, y: p.y + shift });
    if (!r.ok) actions.notify('error', r.message);
  }

  const compositeId = (def: NodeTypeDef) => def.id.slice('composite:'.length);

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
              {category === COMPOSITE_CATEGORY && (
                <span className="palette__item-actions">
                  <button type="button" aria-label={compositeMessages.open(def.title)} title={compositeMessages.open(def.title)} onClick={() => actions.openComposite(compositeId(def))}>
                    ↗
                  </button>
                  <button type="button" aria-label={compositeMessages.rename(def.title)} title={compositeMessages.rename(def.title)} onClick={() => setRenaming(def)}>
                    ✎
                  </button>
                  <button type="button" aria-label={compositeMessages.remove(def.title)} title={compositeMessages.remove(def.title)} onClick={() => setDeleting(def)}>
                    ✕
                  </button>
                </span>
              )}
            </div>
          ))}
        </section>
      ))}
      {renaming && (
        <NameDialog
          title={compositeMessages.renameTitle}
          label={compositeMessages.nameLabel}
          submitLabel={compositeMessages.renameButton}
          initial={renaming.title}
          onSubmit={(name) => actions.renameComposite(compositeId(renaming), name)}
          onClose={() => setRenaming(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={compositeMessages.removeTitle}
          text={compositeMessages.removeText(deleting.title, actions.compositeUsage(compositeId(deleting)))}
          confirmLabel={workflowMessages.deleteButton}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            actions.deleteComposite(compositeId(deleting));
            setDeleting(null);
          }}
        />
      )}
    </aside>
  );
}

// Палитра — плавающее окно с вкладками категорий (FR-001; фича 002: FR-005, FR-006, research R11)
import { useState, type DragEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import { categories, COMPOSITE_CATEGORY, type NodeTypeDef } from '../../engine';
import { useActions, useAppState } from '../../store/react';
import { registryOf } from '../../store/registry';
import { activeTab, tabGraph } from '../../store/store';
import { useUi, useUiActions } from '../../store/ui';
import { NODE_DRAG_TYPE } from '../canvas/Canvas';
import { ConfirmDialog } from '../dialogs/ConfirmDialog';
import { NameDialog } from '../dialogs/NameDialog';
import { ManagedWindow } from '../floating/ManagedWindow';
import { compositeMessages, messages, typeLabels, windowMessages, workflowMessages } from '../messages';

/** Краткая строка портов для карточки: «a, b → result» (FR-001). */
function portsLine(def: NodeTypeDef): string {
  const names = (ps: NodeTypeDef['inputs']) => ps.map((p) => p.name).join(', ') || '—';
  return `${names(def.inputs)} → ${names(def.outputs)}`;
}

function portsSummary(def: NodeTypeDef): string {
  const fmt = (ps: NodeTypeDef['inputs']) =>
    ps.map((p) => `${p.name}: ${typeLabels[p.type]}`).join(', ') || '—';
  return messages.portsSummary(fmt(def.inputs), fmt(def.outputs));
}

/** Порядок вкладок: категории движка, затем составные ноды, затем остальные (интерфейс составного нода). */
const TAB_ORDER: string[] = [...Object.values(categories), COMPOSITE_CATEGORY];
const tabRank = (category: string) => {
  const i = TAB_ORDER.indexOf(category);
  return i === -1 ? TAB_ORDER.length : i;
};

export function Palette() {
  const actions = useActions();
  const registry = useAppState(registryOf);
  const count = useAppState((s) => tabGraph(s, activeTab(s))?.nodes.length ?? 0);
  const insideComposite = useAppState((s) => activeTab(s)?.kind === 'composite');
  const unavailable = useAppState((s) => s.unavailable).filter((u) => u.kind === 'composite');
  const { screenToFlowPosition } = useReactFlow();
  const [renaming, setRenaming] = useState<NodeTypeDef | null>(null);
  const [deleting, setDeleting] = useState<NodeTypeDef | null>(null);
  const ui = useUiActions();
  const chosen = useUi((s) => s.paletteCategory);

  const groups = new Map<string, NodeTypeDef[]>();
  for (const def of registry.list()) {
    if (def.paletteScope === 'hidden') continue;
    if (def.paletteScope === 'composite' && !insideComposite) continue;
    const list = groups.get(def.category) ?? [];
    list.push(def);
    groups.set(def.category, list);
  }

  function addAtCenter(type: string) {
    // Центр видимой части холста — над палитрой, которая стоит полосой внизу (FR-006)
    const rect = document.querySelector('.react-flow')?.getBoundingClientRect();
    const paletteTop = document.querySelector('.palette')?.getBoundingClientRect().top;
    const bottom = rect && paletteTop && paletteTop > rect.top ? Math.min(paletteTop, rect.bottom) : rect?.bottom;
    const center = rect
      ? { x: rect.left + rect.width / 2, y: (rect.top + bottom!) / 2 }
      : { x: 0, y: 0 };
    const p = screenToFlowPosition(center);
    const shift = (count % 10) * 24;
    const r = actions.addNode(type, { x: p.x + shift, y: p.y + shift });
    if (!r.ok) actions.notify('error', r.message);
  }

  const compositeId = (def: NodeTypeDef) => def.id.slice('composite:'.length);
  if (!groups.has(COMPOSITE_CATEGORY)) groups.set(COMPOSITE_CATEGORY, []);
  const tabs = [...groups.keys()].sort((a, b) => tabRank(a) - tabRank(b));
  const category = chosen !== null && groups.has(chosen) ? chosen : tabs[0]!;
  const defs = groups.get(category)!;

  function onDragStart(e: DragEvent, type: string) {
    e.dataTransfer.setData(NODE_DRAG_TYPE, type);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <ManagedWindow
      id="palette"
      label={messages.palette}
      title={messages.palette}
      className="palette"
      data-testid="palette"
    >
      <p className="palette__hint">{messages.paletteHint}</p>
      <div className="palette__tabs" role="tablist" aria-label={windowMessages.paletteCategories}>
        {tabs.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === category}
            className="palette__tab"
            onClick={() => ui.setPaletteCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <section className="palette__group" role="tabpanel" aria-label={category}>
        {defs.map((def) => (
          <div
            key={def.id}
            className="palette__item"
            draggable
            title={portsSummary(def)}
            onDragStart={(e) => onDragStart(e, def.id)}
            onClick={() => addAtCenter(def.id)}
          >
            <span className="palette__item-title" title={def.title}>
              {def.title}
            </span>
            <span className="palette__item-desc">{def.description}</span>
            {def.paletteScope !== 'composite' && (
              <span className="palette__item-ports">{portsLine(def)}</span>
            )}
            {category === COMPOSITE_CATEGORY && (
              // Кнопки действий не должны добавлять нод щелчком по элементу
              <span className="palette__item-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  aria-label={compositeMessages.open(def.title)}
                  title={compositeMessages.open(def.title)}
                  onClick={() => actions.openComposite(compositeId(def))}
                >
                  ↗
                </button>
                <button
                  type="button"
                  aria-label={compositeMessages.rename(def.title)}
                  title={compositeMessages.rename(def.title)}
                  onClick={() => setRenaming(def)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  aria-label={compositeMessages.remove(def.title)}
                  title={compositeMessages.remove(def.title)}
                  onClick={() => setDeleting(def)}
                >
                  ✕
                </button>
              </span>
            )}
          </div>
        ))}
        {category === COMPOSITE_CATEGORY && defs.length === 0 && unavailable.length === 0 && (
          <p className="palette__empty">{windowMessages.noComposites}</p>
        )}
        {category === COMPOSITE_CATEGORY &&
          unavailable.map((u) => (
            <div key={`bad-${u.id}`} className="palette__item palette__item--unavailable">
              <span className="palette__item-title">{workflowMessages.unavailable(u.id)}</span>
              <span className="palette__item-desc">{u.reason}</span>
            </div>
          ))}
      </section>
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
          text={compositeMessages.removeText(
            deleting.title,
            actions.compositeUsage(compositeId(deleting)),
          )}
          confirmLabel={workflowMessages.deleteButton}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            actions.deleteComposite(compositeId(deleting));
            setDeleting(null);
          }}
        />
      )}
    </ManagedWindow>
  );
}

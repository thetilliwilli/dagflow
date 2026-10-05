// Холст: React Flow в управляемом режиме; источник истины — граф активной вкладки (research R6)
import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Edge as RfEdge,
  type EdgeChange,
  type Node as RfNode,
  type NodeChange,
} from '@xyflow/react';
import { activeTab, tabGraph } from '../../store/store';
import { useActions, useApp, useAppState } from '../../store/react';
import { useUi, useUiActions, useUiStore } from '../../store/ui';
import { CompositeNameDialog } from '../dialogs/CompositeNameDialog';
import { compositeMessages, historyMessages } from '../messages';
import { useShortcuts } from './useShortcuts';
import { FlowNode } from './FlowNode';

export const NODE_DRAG_TYPE = 'application/dagflow-node';

const nodeTypes = { flow: FlowNode };

export function Canvas() {
  const actions = useActions();
  const graph = useAppState((s) => tabGraph(s, activeTab(s)));
  const tab = useAppState(activeTab);
  const [initialViewport] = useState(() => tab?.viewport);
  // Вкладка открыта впервые (положение холста не сохранено) и граф не пуст — показать его целиком.
  // На пустом графе не подгоняем: иначе вид «прыгнет» при добавлении первого нода.
  const [fitOnOpen] = useState(() => {
    const v = initialViewport;
    const isDefault = !v || (v.x === 0 && v.y === 0 && v.zoom === 1);
    return isDefault && (graph?.nodes.length ?? 0) > 0;
  });
  const { screenToFlowPosition } = useReactFlow();
  const [rfNodes, setRfNodes] = useState<RfNode[]>([]);
  const ui = useUiActions();
  const uiStore = useUiStore();
  const app = useApp();
  // Выделение живёт в сторе интерфейса (research R4): React Flow лишь показывает его
  const selection = useUi((s) => s.selection);
  // Во время связывания ноды нельзя двигать и выделять (US4, research R5)
  const linkingKind = useUi((s) => s.linking.kind);
  const linking = linkingKind !== 'idle';
  const peek = useUi((s) =>
    s.linking.kind === 'dragging' || s.linking.kind === 'picking' ? s.linking.peek : null,
  );
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(new Set());

  // Синхронизация нодов React Flow с графом, с сохранением размеров и выделения
  const graphNodes = graph?.nodes;
  useEffect(() => {
    setRfNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return (graphNodes ?? []).map((n) => {
        const p = byId.get(n.id);
        if (!p) return { id: n.id, type: 'flow', position: n.position, data: {} };
        return p.position === n.position ? p : { ...p, position: n.position };
      });
    });
  }, [graphNodes]);

  const rfEdges = useMemo<RfEdge[]>(
    () =>
      (graph?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.source.node,
        target: e.target.node,
        selected: selectedEdges.has(e.id),
      })),
    [graph?.edges, selectedEdges],
  );

  useShortcuts(actions);
  const canUndo = useAppState((s) => (s.history[s.activeTabId ?? '']?.past.length ?? 0) > 0);
  const canRedo = useAppState((s) => (s.history[s.activeTabId ?? '']?.future.length ?? 0) > 0);

  // Удаление нодов и связей приходит одним вызовом onDelete — один шаг истории
  const nodes = useMemo(() => {
    const selected = new Set(selection);
    return rfNodes.map((n) => {
      const className = n.id === peek ? 'is-link-target' : undefined;
      return !!n.selected === selected.has(n.id) && n.className === className
        ? n
        : { ...n, selected: selected.has(n.id), className };
    });
  }, [rfNodes, selection, peek]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((nodes) =>
        applyNodeChanges(
          changes.filter((c) => c.type !== 'remove' && c.type !== 'select'),
          nodes,
        ),
      );
      const select = changes.filter((c) => c.type === 'select');
      if (select.length > 0) {
        // Текущее выделение — из стора (не из замыкания) и только ноды графа этой вкладки:
        // React Flow прежней вкладки может прислать изменение уже после сброса выделения
        const state = app.store.getState();
        const ids = new Set(tabGraph(state, activeTab(state))?.nodes.map((n) => n.id));
        const next = new Set(uiStore.getState().selection.filter((id) => ids.has(id)));
        for (const c of select) {
          if (c.selected && ids.has(c.id)) next.add(c.id);
          else next.delete(c.id);
        }
        ui.setSelection([...next]);
      }
      for (const c of changes) {
        if (c.type === 'position' && c.position)
          actions.moveNode(c.id, { x: c.position.x, y: c.position.y });
      }
    },
    [actions, app, ui, uiStore],
  );

  const onDelete = useCallback(
    ({ nodes, edges }: { nodes: RfNode[]; edges: RfEdge[] }) => {
      actions.deleteElements(
        nodes.map((n) => n.id),
        edges.map((e) => e.id),
      );
    },
    [actions],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setSelectedEdges((prev) => {
        const selected = applyEdgeChanges(changes, rfEdges)
          .filter((e) => e.selected)
          .map((e) => e.id);
        const next = new Set(selected);
        return next.size === prev.size && [...next].every((id) => prev.has(id)) ? prev : next;
      });
    },
    [rfEdges],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(NODE_DRAG_TYPE);
      if (!type) return;
      const r = actions.addNode(type, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      if (!r.ok) actions.notify('error', r.message);
    },
    [actions, screenToFlowPosition],
  );

  // Режим привязки: щелчок по ноду показывает его временное окно, по пустому холсту — отмена.
  // Стабильные обработчики: новые функции на каждую перерисовку перерисовывали бы все ноды.
  const onNodeClick = useCallback(
    (_e: unknown, n: RfNode) => {
      if (linkingKind === 'picking') ui.setPeek(n.id);
    },
    [linkingKind, ui],
  );
  const onPaneClick = useCallback(() => {
    if (linkingKind === 'picking') ui.cancelLinking();
  }, [linkingKind, ui]);

  const [collapsing, setCollapsing] = useState<string[] | null>(null);
  const selected = selection;

  return (
    <div className="canvas" data-testid="canvas">
      <div className="canvas-toolbar">
        <button type="button" disabled={!canUndo} title="Ctrl+Z" onClick={() => actions.undo()}>
          {historyMessages.undo}
        </button>
        <button
          type="button"
          disabled={!canRedo}
          title="Ctrl+Shift+Z"
          onClick={() => actions.redo()}
        >
          {historyMessages.redo}
        </button>
        {selected.length > 0 && (
          <button type="button" onClick={() => setCollapsing(selected)}>
            {compositeMessages.collapse}
          </button>
        )}
      </div>
      {collapsing && (
        <CompositeNameDialog nodeIds={collapsing} onClose={() => setCollapsing(null)} />
      )}
      <ReactFlow
        nodes={nodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onDelete={onDelete}
        deleteKeyCode={['Delete', 'Backspace']}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        // Порты на карточке убраны: связи создаются в окнах свойств (US4)
        nodesConnectable={false}
        defaultViewport={initialViewport}
        fitView={fitOnOpen}
        fitViewOptions={{ maxZoom: 1 }}
        // Пробел открывает палитру (FR-005), поэтому не панорамирует холст (research R7)
        panActivationKeyCode={null}
        onMoveEnd={(_e, vp) => tab && actions.setViewport(tab.id, vp)}
        nodesDraggable={!linking}
        elementsSelectable={!linking}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <Background />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable ariaLabel={historyMessages.minimap} />
      </ReactFlow>
    </div>
  );
}

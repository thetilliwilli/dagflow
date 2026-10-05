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
  type Connection,
  type FinalConnectionState,
  type IsValidConnection,
  type Edge as RfEdge,
  type EdgeChange,
  type Node as RfNode,
  type NodeChange,
} from '@xyflow/react';
import { registryOf } from '../../store/registry';
import { activeTab, tabGraph } from '../../store/store';
import { canConnect } from '../../engine';
import { useActions, useApp, useAppState } from '../../store/react';
import { useUi, useUiActions } from '../../store/ui';
import { tryConnect } from './connection';
import { CompositeNameDialog } from '../dialogs/CompositeNameDialog';
import { compositeMessages, historyMessages } from '../messages';
import { useShortcuts } from './useShortcuts';
import { FlowNode } from './FlowNode';
import { inHandle, outHandle, portOfHandle } from './PortHandle';

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
  // Выделение живёт в сторе интерфейса (research R4): React Flow лишь показывает его
  const selection = useUi((s) => s.selection);
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
        sourceHandle: outHandle(e.source.port),
        target: e.target.node,
        targetHandle: inHandle(e.target.port),
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
    return rfNodes.map((n) => (!!n.selected === selected.has(n.id) ? n : { ...n, selected: selected.has(n.id) }));
  }, [rfNodes, selection]);

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
        const next = new Set(selection);
        for (const c of select) {
          if (c.selected) next.add(c.id);
          else next.delete(c.id);
        }
        ui.setSelection([...next]);
      }
      for (const c of changes) {
        if (c.type === 'position' && c.position)
          actions.moveNode(c.id, { x: c.position.x, y: c.position.y });
      }
    },
    [actions, selection, ui],
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

  const app = useApp();
  const toRefs = (c: {
    source: string;
    sourceHandle?: string | null;
    target: string;
    targetHandle?: string | null;
  }) => ({
    source: { node: c.source, port: portOfHandle(c.sourceHandle) },
    target: { node: c.target, port: portOfHandle(c.targetHandle) },
  });

  // Подсветка недопустимого порта во время перетаскивания связи
  const isValidConnection = useCallback<IsValidConnection>(
    (c) => {
      const state = app.store.getState();
      const g = tabGraph(state, activeTab(state));
      return !!g && canConnect(g, toRefs(c), registryOf(state)).ok;
    },
    [app],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      const { source, target } = toRefs(c);
      tryConnect(actions, source, target);
    },
    [actions],
  );

  // Связь отпущена на недопустимый порт: React Flow не вызывает onConnect — объясняем причину
  const onConnectEnd = useCallback(
    (_e: MouseEvent | TouchEvent, s: FinalConnectionState) => {
      if (s.isValid || !s.fromHandle || !s.toHandle) return;
      const from = s.fromHandle.type === 'source' ? s.fromHandle : s.toHandle;
      const to = s.fromHandle.type === 'source' ? s.toHandle : s.fromHandle;
      tryConnect(
        actions,
        { node: from.nodeId, port: portOfHandle(from.id) },
        { node: to.nodeId, port: portOfHandle(to.id) },
      );
    },
    [actions],
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
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        defaultViewport={initialViewport}
        fitView={fitOnOpen}
        fitViewOptions={{ maxZoom: 1 }}
        // Пробел открывает палитру (FR-005), поэтому не панорамирует холст (research R7)
        panActivationKeyCode={null}
        onMoveEnd={(_e, vp) => tab && actions.setViewport(tab.id, vp)}
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

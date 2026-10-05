// Холст: React Flow в управляемом режиме; источник истины — граф активной вкладки (research R6)
import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
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
import { tryConnect } from './connection';
import { FlowNode } from './FlowNode';
import { inHandle, outHandle, portOfHandle } from './PortHandle';

export const NODE_DRAG_TYPE = 'application/dagflow-node';

const nodeTypes = { flow: FlowNode };

export function Canvas() {
  const actions = useActions();
  const graph = useAppState((s) => tabGraph(s, activeTab(s)));
  const tab = useAppState(activeTab);
  const [initialViewport] = useState(() => tab?.viewport);
  const { screenToFlowPosition } = useReactFlow();
  const [rfNodes, setRfNodes] = useState<RfNode[]>([]);
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

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((nodes) => applyNodeChanges(changes, nodes));
      const removed: string[] = [];
      for (const c of changes) {
        if (c.type === 'position' && c.position)
          actions.moveNode(c.id, { x: c.position.x, y: c.position.y });
        if (c.type === 'remove') removed.push(c.id);
      }
      if (removed.length > 0) actions.deleteNodes(removed);
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
      for (const c of changes) if (c.type === 'remove') actions.disconnect(c.id);
    },
    [actions, rfEdges],
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
      actions.addNode(type, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [actions, screenToFlowPosition],
  );

  return (
    <div className="canvas" data-testid="canvas">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        defaultViewport={initialViewport}
        onMoveEnd={(_e, vp) => tab && actions.setViewport(tab.id, vp)}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <Background />
      </ReactFlow>
    </div>
  );
}

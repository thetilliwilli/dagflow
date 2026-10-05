// Холст: React Flow в управляемом режиме; источник истины — граф активной вкладки (research R6)
import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge as RfEdge,
  type EdgeChange,
  type Node as RfNode,
  type NodeChange,
} from '@xyflow/react';
import { useActions, useAppState } from '../../store/react';
import { activeTab, tabGraph } from '../../store/store';
import { FlowNode } from './FlowNode';
import { inHandle, outHandle, portOfHandle } from './PortHandle';

export const NODE_DRAG_TYPE = 'application/dagflow-node';

const nodeTypes = { flow: FlowNode };

export function Canvas() {
  const actions = useActions();
  const graph = useAppState((s) => tabGraph(s, activeTab(s)));
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
        if (c.type === 'position' && c.position) actions.moveNode(c.id, { x: c.position.x, y: c.position.y });
        if (c.type === 'remove') removed.push(c.id);
      }
      if (removed.length > 0) actions.deleteNodes(removed);
    },
    [actions],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setSelectedEdges((prev) => {
        const selected = applyEdgeChanges(changes, rfEdges).filter((e) => e.selected).map((e) => e.id);
        const next = new Set(selected);
        return next.size === prev.size && [...next].every((id) => prev.has(id)) ? prev : next;
      });
      for (const c of changes) if (c.type === 'remove') actions.disconnect(c.id);
    },
    [actions, rfEdges],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      actions.connect({ node: c.source, port: portOfHandle(c.sourceHandle) }, { node: c.target, port: portOfHandle(c.targetHandle) });
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
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <Background />
      </ReactFlow>
    </div>
  );
}

import type { Edge, Graph, JsonValue, NodeInstance } from '../../../src/engine/types';

let edgeSeq = 0;

export function node(id: string, type: string, values: Record<string, JsonValue> = {}): NodeInstance {
  return { id, type, position: { x: 0, y: 0 }, values };
}

export function edge(source: string, sourcePort: string, target: string, targetPort: string): Edge {
  edgeSeq += 1;
  return {
    id: `e${edgeSeq}`,
    source: { node: source, port: sourcePort },
    target: { node: target, port: targetPort },
  };
}

export function graph(nodes: NodeInstance[], edges: Edge[] = []): Graph {
  return { nodes, edges };
}

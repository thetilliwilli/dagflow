import type { Edge, Graph, JsonValue, NodeInstance } from '../src/types';

let edgeSeq = 0;

/** Имя по умолчанию — id: в тестах так проще узнать нод в сообщениях. */
export function node(
  id: string,
  type: string,
  values: Record<string, JsonValue> = {},
  name = id,
): NodeInstance {
  return { id, type, name, position: { x: 0, y: 0 }, values };
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

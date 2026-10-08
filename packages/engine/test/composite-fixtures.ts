import type { CompositeDef, Graph, NodeInstance, PortDef } from '../src';
import { edge, node } from './helpers';

export function io(
  id: string,
  type: 'builtin:input' | 'builtin:output',
  ports: PortDef[],
): NodeInstance {
  return { ...node(id, type), ports };
}

export function def(id: string, name: string, graph: Graph): CompositeDef {
  return { id, name, description: '', graph, createdAt: '', updatedAt: '' };
}

/** «Удвоенная сумма»: (a + b) × k, где k задан на ноде «Умножить». */
export function doubleSum(k = 2, id = 'DS'): CompositeDef {
  return def(id, 'Удвоенная сумма', {
    nodes: [
      io('ia', 'builtin:input', [{ name: 'a', type: 'number', required: true }]),
      io('ib', 'builtin:input', [{ name: 'b', type: 'number', required: true }]),
      node('add', 'builtin:add'),
      node('mul', 'builtin:multiply', { b: k }),
      io('o', 'builtin:output', [{ name: 'result', type: 'number' }]),
    ],
    // Фиксированные id связей: одинаковые определения должны совпадать целиком (канонический JSON)
    edges: [
      { ...edge('ia', 'a', 'add', 'a'), id: 'e-a' },
      { ...edge('ib', 'b', 'add', 'b'), id: 'e-b' },
      { ...edge('add', 'result', 'mul', 'a'), id: 'e-sum' },
      { ...edge('mul', 'result', 'o', 'result'), id: 'e-out' },
    ],
  });
}

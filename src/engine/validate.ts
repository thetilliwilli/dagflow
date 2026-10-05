// Проверка правок графа: связи, добавление нодов, целостность (FR-004, FR-005a, data-model «Edge»)
import { MAX_NODE_NAME, rejections, type Rejection } from './errors';
import type { CompositeDef, Edge, Graph, LinkEnd, NodeInstance, NodeRegistry, PortDef } from './types';
import { isCompatible } from './values';

import { IO_INPUT, IO_OUTPUT, PASSTHROUGH } from './builtins/io';

export const IO_NODE_TYPES = [IO_INPUT, IO_OUTPUT];

export interface NodePorts {
  inputs: PortDef[];
  outputs: PortDef[];
}

/** Порты конкретного нода (у нодов «Вход»/«Выход» они берутся из экземпляра). */
export function nodePorts(node: NodeInstance, registry: NodeRegistry): NodePorts | undefined {
  const def = registry.get(node.type);
  if (!def) return undefined;
  const ports = node.ports ?? [];
  const asOutputs = () => ports.map((p) => ({ name: p.name, type: p.type }));
  if (node.type === IO_INPUT) return { inputs: [], outputs: asOutputs() };
  if (node.type === IO_OUTPUT) return { inputs: ports, outputs: [] };
  if (node.type === PASSTHROUGH) return { inputs: ports, outputs: asOutputs() };
  return { inputs: def.inputs, outputs: def.outputs };
}

/** Проверка и нормализация имени экземпляра нода (FR-009, E13). */
export function normalizeNodeName(name: string): { ok: true; name: string } | Rejection {
  const trimmed = name.trim();
  if (trimmed.length === 0) return rejections.emptyName();
  if (trimmed.length > MAX_NODE_NAME) return rejections.nameTooLong();
  return { ok: true, name: trimmed };
}

/** Достижим ли `to` из `from` по связям графа. */
function reachable(graph: Graph, from: string, to: string): boolean {
  const next = new Map<string, string[]>();
  for (const e of graph.edges) {
    const list = next.get(e.source.node);
    if (list) list.push(e.target.node);
    else next.set(e.source.node, [e.target.node]);
  }
  const stack = [from];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(next.get(id) ?? []));
  }
  return false;
}

export function canConnect(
  graph: Graph,
  edge: Omit<Edge, 'id'>,
  registry: NodeRegistry,
): { ok: true; replaces?: string } | Rejection {
  if (edge.source.node === edge.target.node) return rejections.sameNode();
  const source = graph.nodes.find((n) => n.id === edge.source.node);
  const target = graph.nodes.find((n) => n.id === edge.target.node);
  const sourcePort = source && nodePorts(source, registry)?.outputs.find((p) => p.name === edge.source.port);
  if (!sourcePort) return rejections.unknownPort(edge.source.port);
  const targetPort = target && nodePorts(target, registry)?.inputs.find((p) => p.name === edge.target.port);
  if (!targetPort) return rejections.unknownPort(edge.target.port);
  if (!isCompatible(sourcePort.type, targetPort.type)) {
    return rejections.typeMismatch(sourcePort.type, targetPort.type);
  }
  if (reachable(graph, edge.target.node, edge.source.node)) return rejections.cycle();
  const occupied = graph.edges.find(
    (e) => e.target.node === edge.target.node && e.target.port === edge.target.port,
  );
  return occupied ? { ok: true, replaces: occupied.id } : { ok: true };
}

/** Можно ли связать порт с параметром, с которого начато связывание; replaces — id заменяемой связи. */
export type LinkCandidate = { ok: true; replaces?: string } | Rejection;

export interface LinkCandidates {
  inputs: Record<string, LinkCandidate>;
  outputs: Record<string, LinkCandidate>;
}

/**
 * Доступность каждого порта нода targetNode для связи с from (фича 002: FR-019, FR-020, E10–E12).
 * Записи есть для всех портов в их порядке — окно не меняет состав строк при затенении.
 */
export function linkCandidates(
  graph: Graph,
  from: LinkEnd,
  targetNode: string,
  registry: NodeRegistry,
): LinkCandidates | Rejection {
  const target = graph.nodes.find((n) => n.id === targetNode);
  const ports = target && nodePorts(target, registry);
  if (!target || !ports) return rejections.unknownType(target?.type ?? targetNode);
  const check = (side: 'in' | 'out', port: string): LinkCandidate => {
    if (targetNode === from.node) return rejections.sameNode();
    if (side === from.side) return rejections.sameSide(from.side);
    // Связь всегда идёт от выхода ко входу
    const edge =
      from.side === 'out'
        ? { source: { node: from.node, port: from.port }, target: { node: targetNode, port } }
        : { source: { node: targetNode, port }, target: { node: from.node, port: from.port } };
    return canConnect(graph, edge, registry);
  };
  return {
    inputs: Object.fromEntries(ports.inputs.map((p) => [p.name, check('in', p.name)])),
    outputs: Object.fromEntries(ports.outputs.map((p) => [p.name, check('out', p.name)])),
  };
}

export function canAddNode(
  _graph: Graph,
  typeId: string,
  ctx: { insideComposite?: string },
  registry: NodeRegistry,
  composites: CompositeDef[],
): { ok: true } | Rejection {
  if (IO_NODE_TYPES.includes(typeId) && !ctx.insideComposite) return rejections.ioOutsideComposite();
  const def = registry.get(typeId);
  if (!def || def.paletteScope === 'hidden') return rejections.unknownType(typeId);
  const added = typeId.startsWith('composite:') ? typeId.slice('composite:'.length) : null;
  if (added && ctx.insideComposite) {
    // Рекурсия: добавляемый нод — это сам составной нод или он уже (косвенно) содержит его (FR-026)
    const deps = new Map<string, string[]>(composites.map((c) => [c.id, c.graph.nodes.map((n) => n.type)]));
    const seen = new Set<string>();
    const stack = [added];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === ctx.insideComposite) return rejections.compositeRecursion(def.title);
      if (seen.has(id)) continue;
      seen.add(id);
      for (const t of deps.get(id) ?? []) if (t.startsWith('composite:')) stack.push(t.slice('composite:'.length));
    }
  }
  return { ok: true };
}

/** Полная проверка графа (импорт): типы нодов, порты, совместимость, один источник на вход, циклы. */
export function validateGraph(
  graph: Graph,
  registry: NodeRegistry,
  ctx: { insideComposite?: boolean } = {},
): Rejection[] {
  const errors: Rejection[] = [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const n of graph.nodes) {
    if (IO_NODE_TYPES.includes(n.type) && !ctx.insideComposite) errors.push(rejections.ioOutsideComposite());
    else if (!registry.get(n.type)) errors.push(rejections.unknownType(n.type));
  }
  const usedInputs = new Set<string>();
  for (const e of graph.edges) {
    const s = byId.get(e.source.node);
    const t = byId.get(e.target.node);
    const sp = s && nodePorts(s, registry)?.outputs.find((p) => p.name === e.source.port);
    const tp = t && nodePorts(t, registry)?.inputs.find((p) => p.name === e.target.port);
    if (!s || !t) continue; // о неизвестном ноде уже сообщено
    if (!sp) {
      errors.push(rejections.unknownPort(e.source.port));
      continue;
    }
    if (!tp) {
      errors.push(rejections.unknownPort(e.target.port));
      continue;
    }
    if (!isCompatible(sp.type, tp.type)) errors.push(rejections.typeMismatch(sp.type, tp.type));
    const key = `${e.target.node}\u0000${e.target.port}`;
    if (usedInputs.has(key)) errors.push(rejections.inputOccupied(e.target.port));
    usedInputs.add(key);
  }
  if (topologicalOrder(graph) === null) errors.push(rejections.cycle());
  return errors;
}

/** Топологический порядок всех нодов (Кан, стабильный по порядку в graph.nodes) или null при цикле. */
export function topologicalOrder(graph: Graph): string[] | null {
  const indegree = new Map(graph.nodes.map((n) => [n.id, 0]));
  const next = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!indegree.has(e.source.node) || !indegree.has(e.target.node)) continue;
    indegree.set(e.target.node, indegree.get(e.target.node)! + 1);
    const list = next.get(e.source.node);
    if (list) list.push(e.target.node);
    else next.set(e.source.node, [e.target.node]);
  }
  const order: string[] = [];
  const ready = graph.nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const t of next.get(id) ?? []) {
      const d = indegree.get(t)! - 1;
      indegree.set(t, d);
      if (d === 0) ready.push(t);
    }
  }
  return order.length === graph.nodes.length ? order : null;
}

// Реактивное инкрементальное вычисление (research R2, contracts/engine-api.md E1–E7)
import { internalErrorMessage, NodeError } from './errors';
import type {
  CompositeDef,
  Graph,
  Inputs,
  JsonValue,
  NodeInstance,
  NodeRegistry,
  NodeState,
  PortRef,
} from './types';
import { nodePorts, topologicalOrder } from './validate';

export interface Evaluator {
  /** Заменить структуру (ноды/связи/определения). Грязными становятся только изменившиеся ноды. */
  setGraph(graph: Graph, composites: CompositeDef[]): void;
  /** Изменить значение входа без перестройки структуры. */
  setValue(nodeId: string, port: string, value: JsonValue): void;
  /** Ноды, которые будут пересчитаны при следующем flush, — статус 'computing'. */
  pending(): ReadonlySet<string>;
  /** Пересчитать грязные ноды в топологическом порядке; вернуть их новые состояния. */
  flush(): Map<string, NodeState>;
  /** Текущее состояние нода. */
  state(nodeId: string): NodeState;
}

const EMPTY: NodeState = { status: 'computing', inputs: {}, outputs: {} };

export function createEvaluator(registry: NodeRegistry): Evaluator {
  let order: string[] = [];
  let nodes = new Map<string, NodeInstance>();
  /** target node → input port → источник */
  let incoming = new Map<string, Map<string, PortRef>>();
  let children = new Map<string, Set<string>>();
  let signatures = new Map<string, string>();
  const states = new Map<string, NodeState>();
  const dirty = new Set<string>();
  let pendingCache: Set<string> | null = null;

  function signature(n: NodeInstance): string {
    const inc = [...(incoming.get(n.id) ?? new Map<string, PortRef>()).entries()]
      .map(([port, src]) => `${port}<${src.node}.${src.port}`)
      .sort();
    return JSON.stringify([n.type, n.values, n.ports ?? null, inc]);
  }

  function markDirty(id: string) {
    dirty.add(id);
    pendingCache = null;
  }

  function pending(): Set<string> {
    if (pendingCache) return pendingCache;
    const result = new Set<string>();
    const stack = [...dirty];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (result.has(id) || !nodes.has(id)) continue;
      result.add(id);
      stack.push(...(children.get(id) ?? []));
    }
    pendingCache = result;
    return result;
  }

  function title(id: string): string {
    const n = nodes.get(id);
    return (n && registry.get(n.type)?.title) ?? id;
  }

  function blockedMessage(sourceId: string, source: NodeState | undefined): string {
    if (source?.status === 'blocked' && source.message) return source.message;
    if (source?.status === 'waiting') return `Нод «${title(sourceId)}» выше по графу ожидает входов`;
    return `Нод «${title(sourceId)}» выше по графу завершился ошибкой`;
  }

  function evaluateNode(id: string): NodeState {
    const n = nodes.get(id)!;
    const def = registry.get(n.type);
    const ports = nodePorts(n, registry);
    if (!def || !ports) {
      return { status: 'error', inputs: {}, outputs: {}, message: `Неизвестный тип нода: ${n.type}` };
    }
    const inputs: Inputs = {};
    let missing: string | undefined;
    let blocked: string | undefined;
    for (const p of ports.inputs) {
      const src = incoming.get(id)?.get(p.name);
      if (src) {
        const s = states.get(src.node);
        const v = s?.status === 'ok' ? s.outputs[src.port] : undefined;
        if (v === undefined) blocked ??= blockedMessage(src.node, s);
        else inputs[p.name] = v;
      } else if (Object.hasOwn(n.values, p.name)) {
        inputs[p.name] = n.values[p.name]!;
      } else if (p.default !== undefined) {
        inputs[p.name] = p.default;
      } else if (p.required) {
        missing ??= p.name;
      }
    }
    if (missing) return { status: 'waiting', inputs, outputs: {}, message: `Заполните вход «${missing}»` };
    if (blocked) return { status: 'blocked', inputs, outputs: {}, message: blocked };
    try {
      return { status: 'ok', inputs, outputs: def.compute ? def.compute(inputs) : {} };
    } catch (e) {
      const message = e instanceof NodeError ? e.userMessage : internalErrorMessage(def.title);
      return { status: 'error', inputs, outputs: {}, message };
    }
  }

  return {
    setGraph(graph) {
      nodes = new Map(graph.nodes.map((n) => [n.id, n]));
      incoming = new Map();
      children = new Map();
      for (const e of graph.edges) {
        if (!nodes.has(e.source.node) || !nodes.has(e.target.node)) continue;
        if (!incoming.has(e.target.node)) incoming.set(e.target.node, new Map());
        incoming.get(e.target.node)!.set(e.target.port, e.source);
        if (!children.has(e.source.node)) children.set(e.source.node, new Set());
        children.get(e.source.node)!.add(e.target.node);
      }
      order = topologicalOrder(graph) ?? [];
      const nextSignatures = new Map<string, string>();
      for (const n of graph.nodes) {
        const sig = signature(n);
        nextSignatures.set(n.id, sig);
        if (signatures.get(n.id) !== sig) markDirty(n.id);
      }
      for (const id of signatures.keys()) {
        if (!nodes.has(id)) {
          states.delete(id);
          dirty.delete(id);
        }
      }
      signatures = nextSignatures;
      pendingCache = null;
    },

    setValue(nodeId, port, value) {
      const n = nodes.get(nodeId);
      if (!n) return;
      const updated = { ...n, values: { ...n.values, [port]: value } };
      nodes.set(nodeId, updated);
      signatures.set(nodeId, signature(updated));
      markDirty(nodeId);
    },

    pending,

    flush() {
      const toRun = pending();
      const changed = new Map<string, NodeState>();
      for (const id of order) {
        if (!toRun.has(id)) continue;
        const s = evaluateNode(id);
        states.set(id, s);
        changed.set(id, s);
      }
      dirty.clear();
      pendingCache = null;
      return changed;
    },

    state(nodeId) {
      const s = states.get(nodeId) ?? EMPTY;
      return pending().has(nodeId) ? { ...s, status: 'computing', message: undefined } : s;
    },
  };
}

// Реактивное инкрементальное вычисление (research R2, contracts/engine-api.md E1–E7)
import { IO_INPUT } from './builtins/io';
import { flatten } from './composite';
import { NodeError, stateMessages } from './errors';
import type {
  CompositeDef,
  Graph,
  Inputs,
  JsonValue,
  NodeInstance,
  NodeRegistry,
  NodeState,
  NodeStatus,
  Outputs,
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
  /** Текущее состояние нода верхнего уровня (для экземпляра составного нода — сводное, E9). */
  state(nodeId: string): NodeState;
  /** Состояние внутреннего нода экземпляра по пути `экземпляр/…/нод`. */
  stateAt(path: string): NodeState;
}

/** Приоритет сводного статуса: первопричина важнее следствий (E9). */
const STATUS_PRIORITY: NodeStatus[] = ['error', 'waiting', 'blocked', 'computing', 'ok'];

const EMPTY: NodeState = { status: 'computing', inputs: {}, outputs: {} };

/** Реестр или фабрика реестра по набору составных нодов (тогда он обновляется в setGraph). */
export type RegistrySource = NodeRegistry | ((composites: CompositeDef[]) => NodeRegistry);

export function createEvaluator(source: RegistrySource): Evaluator {
  let registry: NodeRegistry = typeof source === 'function' ? source([]) : source;
  let instances = new Map<string, { inputs: string[]; outputs: string[] }>();
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

  /** Как назвать нод в сообщении: по имени экземпляра (E15). */
  function title(id: string): string {
    return nodes.get(id)?.name ?? id;
  }

  function blockedMessage(sourceId: string, source: NodeState | undefined): string {
    if (source?.status === 'blocked' && source.message) return source.message;
    if (source?.status === 'waiting') return stateMessages.upstreamWaiting(title(sourceId));
    return stateMessages.upstreamFailed(title(sourceId));
  }

  function evaluateNode(id: string): NodeState {
    const n = nodes.get(id)!;
    const def = registry.get(n.type);
    const ports = nodePorts(n, registry);
    if (!def || !ports) {
      return {
        status: 'error',
        inputs: {},
        outputs: {},
        message: stateMessages.unknownType(n.type),
      };
    }
    const inputs: Inputs = {};
    let missing: string | undefined;
    let blocked: string | undefined;
    for (const p of ports.inputs) {
      const src = incoming.get(id)?.get(p.name);
      if (src) {
        const s = states.get(src.node);
        const v = s?.status === 'ok' ? s.outputs[src.port] : undefined;
        if (v === undefined) {
          blocked ??=
            s?.status === 'ok'
              ? stateMessages.noOutputValue(src.port, title(src.node))
              : blockedMessage(src.node, s);
        } else inputs[p.name] = v;
      } else if (Object.hasOwn(n.values, p.name)) {
        inputs[p.name] = n.values[p.name]!;
      } else if (p.default !== undefined) {
        inputs[p.name] = p.default;
      } else if (p.required) {
        missing ??= p.name;
      }
    }
    if (n.type === IO_INPUT) {
      // «Вход» во вкладке составного нода: отдаёт значения по умолчанию своих портов
      const outputs: Outputs = {};
      for (const p of n.ports ?? []) if (p.default !== undefined) outputs[p.name] = p.default;
      return { status: 'ok', inputs: {}, outputs };
    }
    if (missing)
      return { status: 'waiting', inputs, outputs: {}, message: stateMessages.fillInput(missing) };
    if (blocked) return { status: 'blocked', inputs, outputs: {}, message: blocked };
    try {
      return { status: 'ok', inputs, outputs: def.compute ? def.compute(inputs) : {} };
    } catch (e) {
      const message =
        e instanceof NodeError ? e.userMessage : stateMessages.internalError(def.title);
      return { status: 'error', inputs, outputs: {}, message };
    }
  }

  return {
    setGraph(input, composites) {
      if (typeof source === 'function') registry = source(composites);
      const flat = flatten(input, composites);
      instances = flat.instances;
      const graph = flat.graph;
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
      const inst = instances.get(nodeId);
      return inst ? aggregate(nodeId, inst) : flatState(nodeId);
    },

    stateAt(path) {
      return flatState(path);
    },
  };

  function flatState(id: string): NodeState {
    const s = states.get(id) ?? EMPTY;
    if (!pending().has(id)) return s;
    // Без ключа message: состояние уходит по протоколу как JSON (research R5)
    return { status: 'computing', inputs: s.inputs, outputs: s.outputs };
  }

  /** Сводное состояние экземпляра по внутренним нодам (E9). */
  function aggregate(id: string, inst: { inputs: string[]; outputs: string[] }): NodeState {
    const prefix = `${id}/`;
    const inner = [...nodes.keys()].filter((k) => k.startsWith(prefix)).map(flatState);
    const status = STATUS_PRIORITY.find((st) => inner.some((s) => s.status === st)) ?? 'ok';
    const inputs: Inputs = {};
    for (const p of inst.inputs) Object.assign(inputs, flatState(p).inputs);
    const outputs: Outputs = {};
    if (status === 'ok') for (const p of inst.outputs) Object.assign(outputs, flatState(p).outputs);
    const message = inner.find((s) => s.status === status)?.message;
    return message ? { status, inputs, outputs, message } : { status, inputs, outputs };
  }
}

// Составные ноды: порты, зависимости, сворачивание/разворачивание, разворачивание для вычисления (research R3)
import { IO_INPUT, IO_OUTPUT, PASSTHROUGH } from './builtins/io';
import type { Rejection } from './errors';
import type { CompositeDef, Edge, Graph, JsonValue, NodeInstance, NodeRegistry, PortDef, PortRef } from './types';
import { nodePorts } from './validate';

export const COMPOSITE_PREFIX = 'composite:';

export function compositeIdOf(type: string): string | null {
  return type.startsWith(COMPOSITE_PREFIX) ? type.slice(COMPOSITE_PREFIX.length) : null;
}

const isIo = (n: NodeInstance) => n.type === IO_INPUT || n.type === IO_OUTPUT;

/** Глубокая копия JSON-данных графа (structuredClone — API среды, а движок от среды не зависит). */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function stripInput(p: PortDef): PortDef {
  return { name: p.name, type: p.type };
}

/** Порты составного нода из нодов «Вход»/«Выход» (FR-021a, FR-021b). */
export function compositePorts(def: CompositeDef): { inputs: PortDef[]; outputs: PortDef[] } {
  const inputs: PortDef[] = [];
  const outputs: PortDef[] = [];
  for (const n of def.graph.nodes) {
    if (n.type === IO_INPUT) inputs.push(...(n.ports ?? []));
    if (n.type === IO_OUTPUT) outputs.push(...(n.ports ?? []).map(stripInput));
  }
  return { inputs, outputs };
}

/** Уникальность и длина имён портов нодов «Вход» и, отдельно, «Выход» (FR-021c). */
export function validateIoPorts(graph: Graph): Rejection | null {
  for (const kind of [IO_INPUT, IO_OUTPUT]) {
    const seen = new Set<string>();
    for (const n of graph.nodes) {
      if (n.type !== kind) continue;
      for (const p of n.ports ?? []) {
        const name = p.name.trim();
        if (name.length < 1 || name.length > 40) {
          return { ok: false, code: 'duplicate-port-name', message: 'Имя порта должно содержать от 1 до 40 символов.' };
        }
        if (seen.has(name)) {
          const what = kind === IO_INPUT ? 'Вход' : 'Выход';
          return { ok: false, code: 'duplicate-port-name', message: `Порт «${name}» уже есть у другого нода «${what}». Имена портов должны быть уникальны.` };
        }
        seen.add(name);
      }
    }
  }
  return null;
}

/** Транзитивные зависимости определений: id → множество id используемых составных нодов (FR-026, FR-029). */
export function compositeDependencies(defs: CompositeDef[]): Map<string, Set<string>> {
  const direct = new Map<string, string[]>();
  for (const d of defs) {
    direct.set(d.id, d.graph.nodes.map((n) => compositeIdOf(n.type)).filter((x): x is string => x !== null));
  }
  const result = new Map<string, Set<string>>();
  for (const d of defs) {
    const seen = new Set<string>();
    const stack = [...(direct.get(d.id) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(direct.get(id) ?? []));
    }
    result.set(d.id, seen);
  }
  return result;
}

function uniquePortName(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 2; taken.has(name); n += 1) name = `${base}_${n}`;
  taken.add(name);
  return name;
}

/** Свернуть группу нодов в составной нод (FR-021, FR-022). */
export function collapse(
  graph: Graph,
  nodeIds: string[],
  name: string,
  registry: NodeRegistry,
  newId: () => string,
): { graph: Graph; composite: CompositeDef; instanceId: string } | Rejection {
  const group = new Set(nodeIds);
  const inner = graph.nodes.filter((n) => group.has(n.id));
  if (inner.length === 0) return { ok: false, code: 'unknown-port', message: 'Выделите хотя бы один нод.' };
  if (inner.some(isIo)) {
    return { ok: false, code: 'io-node-outside-composite', message: 'Ноды «Вход» и «Выход» нельзя сворачивать в составной нод.' };
  }
  const xs = inner.map((n) => n.position.x);
  const ys = inner.map((n) => n.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const defNodes: NodeInstance[] = inner.map((n) => clone(n));
  const defEdges: Edge[] = graph.edges.filter((e) => group.has(e.source.node) && group.has(e.target.node)).map((e) => clone(e));
  const outerEdges: Edge[] = graph.edges.filter((e) => !group.has(e.source.node) && !group.has(e.target.node));
  const instanceId = newId();
  const portOf = (ref: PortRef, kind: 'inputs' | 'outputs'): PortDef | undefined => {
    const n = graph.nodes.find((x) => x.id === ref.node);
    return n ? nodePorts(n, registry)?.[kind].find((p) => p.name === ref.port) : undefined;
  };

  // Входящие внешние связи → по ноду «Вход» на каждый принимающий порт
  const inNames = new Set<string>();
  const inByTarget = new Map<string, string>();
  graph.edges.forEach((e) => {
    if (group.has(e.source.node) || !group.has(e.target.node)) return;
    const key = `${e.target.node}\u0000${e.target.port}`;
    let portName = inByTarget.get(key);
    if (!portName) {
      const target = portOf(e.target, 'inputs');
      portName = uniquePortName(e.target.port, inNames);
      inByTarget.set(key, portName);
      const ioId = newId();
      defNodes.push({
        id: ioId,
        type: IO_INPUT,
        name: registry.get(IO_INPUT)?.title ?? IO_INPUT,
        position: { x: minX - 400, y: minY + (inByTarget.size - 1) * 170 },
        values: {},
        ports: [{ name: portName, type: target?.type ?? 'any', required: true }],
      });
      defEdges.push({ id: newId(), source: { node: ioId, port: portName }, target: { ...e.target } });
    }
    outerEdges.push({ id: e.id, source: e.source, target: { node: instanceId, port: portName } });
  });

  // Исходящие внешние связи → по ноду «Выход» на каждый отдающий порт
  const outNames = new Set<string>();
  const outBySource = new Map<string, string>();
  graph.edges.forEach((e) => {
    if (!group.has(e.source.node) || group.has(e.target.node)) return;
    const key = `${e.source.node}\u0000${e.source.port}`;
    let portName = outBySource.get(key);
    if (!portName) {
      const source = portOf(e.source, 'outputs');
      portName = uniquePortName(e.source.port, outNames);
      outBySource.set(key, portName);
      const ioId = newId();
      defNodes.push({
        id: ioId,
        type: IO_OUTPUT,
        name: registry.get(IO_OUTPUT)?.title ?? IO_OUTPUT,
        position: { x: maxX + 320, y: minY + (outBySource.size - 1) * 170 },
        values: {},
        ports: [{ name: portName, type: source?.type ?? 'any', required: true }],
      });
      defEdges.push({ id: newId(), source: { ...e.source }, target: { node: ioId, port: portName } });
    }
    outerEdges.push({ id: e.id, source: { node: instanceId, port: portName }, target: e.target });
  });

  const composite: CompositeDef = {
    id: newId(),
    name,
    description: '',
    graph: { nodes: defNodes, edges: defEdges },
    createdAt: '',
    updatedAt: '',
  };
  const instance: NodeInstance = {
    id: instanceId,
    type: `${COMPOSITE_PREFIX}${composite.id}`,
    name,
    position: { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length },
    values: {},
  };
  return {
    graph: { nodes: [...graph.nodes.filter((n) => !group.has(n.id)), instance], edges: outerEdges },
    composite,
    instanceId,
  };
}

/** Развернуть экземпляр составного нода обратно в ноды и связи (FR-025). */
export function expand(graph: Graph, instanceId: string, def: CompositeDef, newId: () => string): Graph {
  const instance = graph.nodes.find((n) => n.id === instanceId);
  if (!instance) return graph;
  const innerNodes = def.graph.nodes.filter((n) => !isIo(n));
  const io = new Map(def.graph.nodes.filter(isIo).map((n) => [n.id, n]));
  const cx = innerNodes.reduce((a, n) => a + n.position.x, 0) / (innerNodes.length || 1);
  const cy = innerNodes.reduce((a, n) => a + n.position.y, 0) / (innerNodes.length || 1);
  const idMap = new Map(innerNodes.map((n) => [n.id, newId()]));
  const copies = new Map(
    innerNodes.map((n) => [
      n.id,
      {
        ...clone(n),
        id: idMap.get(n.id)!,
        position: { x: instance.position.x + n.position.x - cx, y: instance.position.y + n.position.y - cy },
      } as NodeInstance,
    ]),
  );
  const outerIn = new Map<string, PortRef>(); // порт экземпляра → внешний источник
  const outerOut = new Map<string, PortRef[]>(); // порт экземпляра → внешние приёмники
  for (const e of graph.edges) {
    if (e.target.node === instanceId) outerIn.set(e.target.port, e.source);
    if (e.source.node === instanceId) outerOut.set(e.source.port, [...(outerOut.get(e.source.port) ?? []), e.target]);
  }
  const inputDefault = (port: string): JsonValue | undefined => {
    if (Object.hasOwn(instance.values, port)) return instance.values[port];
    for (const n of io.values()) {
      const p = n.type === IO_INPUT ? n.ports?.find((x) => x.name === port) : undefined;
      if (p) return p.default;
    }
    return undefined;
  };
  const edges: Edge[] = graph.edges.filter((e) => e.source.node !== instanceId && e.target.node !== instanceId);
  const link = (source: PortRef, target: PortRef) => edges.push({ id: newId(), source, target });
  for (const e of def.graph.edges) {
    const sIo = io.get(e.source.node);
    const tIo = io.get(e.target.node);
    const sources: PortRef[] = sIo ? (outerIn.has(e.source.port) ? [outerIn.get(e.source.port)!] : []) : [{ node: idMap.get(e.source.node)!, port: e.source.port }];
    const targets: PortRef[] = tIo ? (outerOut.get(e.target.port) ?? []) : [{ node: idMap.get(e.target.node)!, port: e.target.port }];
    if (sIo && sources.length === 0 && !tIo) {
      const v = inputDefault(e.source.port);
      if (v !== undefined) copies.get(e.target.node)!.values[e.target.port] = v;
      continue;
    }
    for (const s of sources) for (const t of targets) link(s, t);
  }
  return { nodes: [...graph.nodes.filter((n) => n.id !== instanceId), ...copies.values()], edges };
}

export interface Flattened {
  graph: Graph;
  /** Путь экземпляра → пути его сквозных нодов входов и выходов. */
  instances: Map<string, { inputs: string[]; outputs: string[] }>;
}

/** Развернуть все экземпляры в плоский граф с id вида `экземпляр/нод` (research R3). */
export function flatten(graph: Graph, composites: CompositeDef[]): Flattened {
  const defs = new Map(composites.map((c) => [c.id, c]));
  const nodes: NodeInstance[] = [];
  const edges: Edge[] = [];
  const instances = new Map<string, { inputs: string[]; outputs: string[] }>();

  function expandGraph(g: Graph, prefix: string, stack: string[], instanceValues: Record<string, JsonValue> | null) {
    const inRef = new Map<string, Map<string, PortRef>>();
    const outRef = new Map<string, Map<string, PortRef>>();
    for (const n of g.nodes) {
      const path = prefix + n.id;
      const cid = compositeIdOf(n.type);
      if (cid !== null) {
        const def = defs.get(cid);
        if (!def || stack.includes(cid)) continue;
        expandGraph(def.graph, `${path}/`, [...stack, cid], n.values);
        const ins = new Map<string, PortRef>();
        const outs = new Map<string, PortRef>();
        const info = { inputs: [] as string[], outputs: [] as string[] };
        for (const io of def.graph.nodes) {
          if (io.type === IO_INPUT) {
            info.inputs.push(`${path}/${io.id}`);
            for (const p of io.ports ?? []) ins.set(p.name, { node: `${path}/${io.id}`, port: p.name });
          } else if (io.type === IO_OUTPUT) {
            info.outputs.push(`${path}/${io.id}`);
            for (const p of io.ports ?? []) outs.set(p.name, { node: `${path}/${io.id}`, port: p.name });
          }
        }
        instances.set(path, info);
        inRef.set(n.id, ins);
        outRef.set(n.id, outs);
        continue;
      }
      if (instanceValues && isIo(n)) {
        const ports = n.ports ?? [];
        const values: Record<string, JsonValue> = {};
        if (n.type === IO_INPUT) for (const p of ports) if (Object.hasOwn(instanceValues, p.name)) values[p.name] = instanceValues[p.name]!;
        nodes.push({ id: path, type: PASSTHROUGH, name: n.name, position: n.position, values, ports });
      } else {
        nodes.push({ ...n, id: path });
      }
    }
    const resolve = (map: Map<string, Map<string, PortRef>>, ref: PortRef): PortRef | undefined => {
      const m = map.get(ref.node);
      if (m) return m.get(ref.port);
      return g.nodes.some((n) => n.id === ref.node && compositeIdOf(n.type) === null) ? { node: prefix + ref.node, port: ref.port } : undefined;
    };
    for (const e of g.edges) {
      const source = resolve(outRef, e.source);
      const target = resolve(inRef, e.target);
      if (source && target) edges.push({ id: prefix + e.id, source, target });
    }
  }

  expandGraph(graph, '', [], null);
  return { graph: { nodes, edges }, instances };
}

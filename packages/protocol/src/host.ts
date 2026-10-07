// Хост протокола: машина состояний без ввода-вывода (contracts/protocol.md «Правила хоста», research R4)
import {
  createEvaluator,
  createRegistry,
  ENGINE_VERSION,
  type CompositeDef,
  type Evaluator,
  type Graph,
  type NodeRegistry,
  type NodeState,
} from '@dagflow/engine';
import * as v from 'valibot';
import { byteLength } from './channel';
import {
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  type ClientMessage,
  type DocId,
  type HostMessage,
  type ProtocolError,
  type Rev,
} from './messages';
import { ClientMessageSchema, describeIssues } from './schemas';

export interface EngineHost {
  /** Принять одно сообщение (строку). Вернуть сообщения для отправки. */
  receive(raw: string): HostMessage[];
  /** Пересчитать накопленные изменения. Вернуть `states` по документам. */
  tick(): HostMessage[];
  /** Есть ли что пересчитывать — адаптер планирует `tick()` своим таймером. */
  needsTick(): boolean;
  /** Закрыть соединение после этого ответа (version-mismatch). */
  readonly closed: boolean;
}

export interface EngineHostOptions {
  /** Реестр нодов по набору составных; по умолчанию — встроенные ноды. */
  registry?: (composites: CompositeDef[]) => NodeRegistry;
  /** Версия engine в `welcome`; по умолчанию — ENGINE_VERSION. */
  engineVersion?: string;
}

interface HostDoc {
  evaluator: Evaluator;
  rev: Rev;
  graph: Graph;
}

/** Внутренние ноды экземпляров имеют id `экземпляр/нод`; клиент видит ноды верхнего уровня. */
const topLevel = (id: string) => id.split('/')[0]!;

const error = (code: ProtocolError['code'], extra: Partial<ProtocolError> = {}): ProtocolError => ({
  type: 'error',
  code,
  ...extra,
});

export function createEngineHost(options: EngineHostOptions = {}): EngineHost {
  const registry = options.registry ?? ((composites) => createRegistry(composites));
  const engine = options.engineVersion ?? ENGINE_VERSION;
  const docs = new Map<DocId, HostDoc>();
  let composites: CompositeDef[] = [];
  let ready = false;
  let closed = false;

  /** Применить граф документа и вернуть `pending`, если есть что пересчитывать. */
  function apply(doc: DocId, entry: HostDoc): HostMessage[] {
    entry.evaluator.setGraph(entry.graph, composites);
    const nodes = [...new Set([...entry.evaluator.pending()].map(topLevel))];
    return nodes.length > 0 ? [{ type: 'pending', doc, rev: entry.rev, nodes }] : [];
  }

  function handle(msg: ClientMessage): HostMessage[] {
    switch (msg.type) {
      case 'hello': {
        const welcome: HostMessage = { type: 'welcome', protocol: PROTOCOL_VERSION, engine };
        if (msg.protocol !== PROTOCOL_VERSION) {
          closed = true;
          return [welcome, error('version-mismatch', { detail: String(PROTOCOL_VERSION) })];
        }
        ready = true;
        return [welcome];
      }
      case 'library':
        composites = msg.composites;
        return [...docs].flatMap(([doc, entry]) => apply(doc, entry));
      case 'open': {
        const entry = docs.get(msg.doc);
        if (entry) return update(msg.doc, entry, msg.rev, msg.graph);
        const created: HostDoc = {
          evaluator: createEvaluator(registry),
          rev: msg.rev,
          graph: msg.graph,
        };
        docs.set(msg.doc, created);
        return apply(msg.doc, created);
      }
      case 'update': {
        const entry = docs.get(msg.doc);
        if (!entry) return [error('unknown-doc', { doc: msg.doc })];
        return update(msg.doc, entry, msg.rev, msg.graph);
      }
      case 'close':
        if (!docs.delete(msg.doc)) return [error('unknown-doc', { doc: msg.doc })];
        return [];
    }
  }

  function update(doc: DocId, entry: HostDoc, rev: Rev, graph: Graph): HostMessage[] {
    // Повтор или устаревшее сообщение — без ответа
    if (rev <= entry.rev) return [];
    entry.rev = rev;
    entry.graph = graph;
    return apply(doc, entry);
  }

  return {
    get closed() {
      return closed;
    },

    receive(raw) {
      if (byteLength(raw) > MAX_MESSAGE_BYTES) return [error('too-large')];
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        return [error('invalid-message', { detail: 'Not JSON' })];
      }
      const parsed = v.safeParse(ClientMessageSchema, data);
      if (!parsed.success) {
        return [error('invalid-message', { detail: describeIssues(parsed.issues) })];
      }
      const msg = parsed.output as ClientMessage;
      if (!ready && msg.type !== 'hello') return [error('not-ready')];
      try {
        return handle(msg);
      } catch (e) {
        const doc = 'doc' in msg ? { doc: msg.doc } : {};
        return [error('internal', { ...doc, detail: e instanceof Error ? e.message : String(e) })];
      }
    },

    tick() {
      const out: HostMessage[] = [];
      for (const [doc, entry] of docs) {
        if (entry.evaluator.pending().size === 0) continue;
        try {
          const changed = entry.evaluator.flush();
          const states: Record<string, NodeState> = {};
          for (const id of new Set([...changed.keys()].map(topLevel))) {
            states[id] = entry.evaluator.state(id);
          }
          out.push({ type: 'states', doc, rev: entry.rev, states });
        } catch (e) {
          out.push(error('internal', { doc, detail: e instanceof Error ? e.message : String(e) }));
        }
      }
      return out;
    },

    needsTick() {
      for (const entry of docs.values()) if (entry.evaluator.pending().size > 0) return true;
      return false;
    },
  };
}

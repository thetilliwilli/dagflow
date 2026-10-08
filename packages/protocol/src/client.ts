// Клиент протокола: машина состояний без ввода-вывода (contracts/protocol.md «Правила клиента», research R4)
import { ENGINE_VERSION, type CompositeDef, type Graph, type NodeState } from '@dagflow/engine';
import * as v from 'valibot';
import { byteLength } from './channel';
import {
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  type ClientMessage,
  type DocId,
  type HostMessage,
  type Rev,
} from './messages';
import { HostMessageSchema } from './schemas';

/** Что сейчас открыто в редакторе: граф каждой вкладки и определения составных нодов. */
export interface Snapshot {
  tabs: { doc: DocId; graph: Graph }[];
  composites: CompositeDef[];
}

export type ClientEvent =
  | { kind: 'ready'; protocol: number; engine: string }
  | { kind: 'incompatible'; host: { protocol: number; engine: string } }
  | { kind: 'pending'; doc: DocId; nodes: string[] }
  | { kind: 'states'; doc: DocId; states: Record<string, NodeState> }
  /** Сообщение больше лимита не отправлено; без doc — набор определений (FR-024). */
  | { kind: 'too-large'; doc?: DocId }
  /** Ранее слишком большое сообщение теперь отправлено. */
  | { kind: 'sent'; doc?: DocId }
  /** Цель не смогла обработать запрос — уведомление (FR-025). */
  | {
      kind: 'failed';
      code: 'invalid-message' | 'internal' | 'too-large';
      doc?: DocId;
      /** По вкладке: будет ли повтор. false — повтор уже был, следующий — при правке (FR-025). */
      retrying?: boolean;
    }
  /** Цель забыла вкладку — передана заново без уведомления (FR-025). */
  | { kind: 'resend'; doc: DocId };

/** Результат шага клиента: события для стора и строки для отправки в канал. */
export interface ClientOutput {
  events: ClientEvent[];
  send: string[];
}

export interface EngineClient {
  /** Соединение открыто: сбросить зеркала и вернуть hello. */
  start(): string[];
  /** Принять сообщение хоста. */
  receive(raw: string): ClientOutput;
  /** Снимок редактора изменился: отправить open/update/close/library по разнице. */
  sync(snapshot: Snapshot): ClientOutput;
}

interface DocMirror {
  rev: Rev;
  /** Последний отправленный граф — сравнение по ссылке. */
  graph: Graph;
  /** Граф, для которого уже был повтор после сбоя: второй раз не повторяем. */
  retried?: Graph;
}

const LIBRARY = Symbol('library');

export interface EngineClientOptions {
  engineVersion?: string;
  /**
   * Лимит сообщения для текущей цели; undefined — без лимита. По умолчанию MAX_MESSAGE_BYTES.
   * Лимит 8 МБ — у сервера (FR-024); в окне и фоновом потоке размер не ограничен (FR-002).
   */
  maxMessageBytes?: () => number | undefined;
}

export function createEngineClient(options: EngineClientOptions = {}): EngineClient {
  const engine = options.engineVersion ?? ENGINE_VERSION;
  const limit = options.maxMessageBytes ?? (() => MAX_MESSAGE_BYTES);
  let snapshot: Snapshot = { tabs: [], composites: [] };
  let phase: 'connecting' | 'ready' | 'incompatible' = 'connecting';
  let mirrors = new Map<DocId, DocMirror>();
  let sentComposites: CompositeDef[] | undefined;
  /**
   * Что сейчас не отправлено из-за лимита: вкладка или набор определений → отклонённые данные.
   * Те же данные (та же ссылка) повторно не сериализуются — новая попытка при правке (FR-024).
   */
  const tooLarge = new Map<DocId | typeof LIBRARY, unknown>();

  const empty = (): ClientOutput => ({ events: [], send: [] });

  /** Сериализовать и отправить, если влезает в лимит; иначе — событие too-large. */
  function emit(
    out: ClientOutput,
    msg: ClientMessage,
    key: DocId | typeof LIBRARY,
    source: unknown,
  ): boolean {
    const text = JSON.stringify(msg);
    const doc = key === LIBRARY ? {} : { doc: key };
    const max = limit();
    if (max !== undefined && byteLength(text) > max) {
      tooLarge.set(key, source);
      out.events.push({ kind: 'too-large', ...doc });
      return false;
    }
    out.send.push(text);
    if (tooLarge.delete(key)) out.events.push({ kind: 'sent', ...doc });
    return true;
  }

  function open(out: ClientOutput, doc: DocId, graph: Graph, rev: Rev) {
    if (emit(out, { type: 'open', doc, rev, graph }, doc, graph)) {
      mirrors.set(doc, { ...mirrors.get(doc), rev, graph });
    }
  }

  function diff(): ClientOutput {
    const out = empty();
    if (phase !== 'ready') return out;
    const { composites } = snapshot;
    if (composites !== sentComposites && tooLarge.get(LIBRARY) !== composites) {
      const msg: ClientMessage = { type: 'library', composites };
      if (emit(out, msg, LIBRARY, composites)) sentComposites = composites;
    }
    const open_ = new Set<DocId>();
    for (const { doc, graph } of snapshot.tabs) {
      open_.add(doc);
      if (tooLarge.get(doc) === graph) continue;
      const mirror = mirrors.get(doc);
      if (!mirror) open(out, doc, graph, 1);
      else if (mirror.graph !== graph) {
        const rev = mirror.rev + 1;
        if (emit(out, { type: 'update', doc, rev, graph }, doc, graph)) {
          mirrors.set(doc, { rev, graph });
        }
      }
    }
    for (const doc of [...mirrors.keys()]) {
      if (open_.has(doc)) continue;
      mirrors.delete(doc);
      out.send.push(JSON.stringify({ type: 'close', doc } satisfies ClientMessage));
    }
    for (const key of [...tooLarge.keys()])
      if (key !== LIBRARY && !open_.has(key)) tooLarge.delete(key);
    return out;
  }

  function graphOf(doc: DocId): Graph | undefined {
    return snapshot.tabs.find((t) => t.doc === doc)?.graph;
  }

  function onError(msg: Extract<HostMessage, { type: 'error' }>): ClientOutput {
    const out = empty();
    const mirror = msg.doc === undefined ? undefined : mirrors.get(msg.doc);
    switch (msg.code) {
      case 'unknown-doc': {
        // Ответ на close по закрытой вкладке — игнорируем
        const graph = msg.doc === undefined ? undefined : graphOf(msg.doc);
        if (!mirror || !graph || msg.doc === undefined) return out;
        out.events.push({ kind: 'resend', doc: msg.doc });
        open(out, msg.doc, graph, mirror.rev + 1);
        return out;
      }
      case 'invalid-message':
      case 'internal': {
        if (msg.doc === undefined) {
          out.events.push({ kind: 'failed', code: msg.code });
          return out;
        }
        const graph = graphOf(msg.doc);
        // Один повтор на граф: если и он не удался — до следующей правки (FR-025)
        const retrying = mirror !== undefined && graph !== undefined && mirror.retried !== graph;
        out.events.push({ kind: 'failed', code: msg.code, doc: msg.doc, retrying });
        if (retrying) {
          open(out, msg.doc, graph, mirror.rev + 1);
          const updated = mirrors.get(msg.doc);
          if (updated) updated.retried = graph;
        }
        return out;
      }
      case 'too-large':
        out.events.push({ kind: 'failed', code: 'too-large' });
        return out;
      default:
        // version-mismatch приходит вслед за welcome (уже incompatible); not-ready — сбой порядка
        return out;
    }
  }

  return {
    start() {
      phase = 'connecting';
      mirrors = new Map();
      sentComposites = undefined;
      tooLarge.clear();
      return [JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, engine })];
    },

    receive(raw) {
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        return { events: [{ kind: 'failed', code: 'invalid-message' }], send: [] };
      }
      const parsed = v.safeParse(HostMessageSchema, data);
      if (!parsed.success) {
        return { events: [{ kind: 'failed', code: 'invalid-message' }], send: [] };
      }
      const msg = parsed.output as HostMessage;
      if (phase !== 'ready') {
        if (msg.type !== 'welcome' || phase === 'incompatible') return empty();
        if (msg.protocol !== PROTOCOL_VERSION) {
          phase = 'incompatible';
          return {
            events: [
              { kind: 'incompatible', host: { protocol: msg.protocol, engine: msg.engine } },
            ],
            send: [],
          };
        }
        phase = 'ready';
        const out = diff();
        out.events.unshift({ kind: 'ready', protocol: msg.protocol, engine: msg.engine });
        return out;
      }
      switch (msg.type) {
        case 'welcome':
          return empty();
        case 'pending':
          if (!mirrors.has(msg.doc)) return empty();
          return { events: [{ kind: 'pending', doc: msg.doc, nodes: msg.nodes }], send: [] };
        case 'states':
          if (!mirrors.has(msg.doc)) return empty();
          return { events: [{ kind: 'states', doc: msg.doc, states: msg.states }], send: [] };
        case 'error':
          return onError(msg);
      }
    },

    sync(next) {
      snapshot = next;
      return diff();
    },
  };
}

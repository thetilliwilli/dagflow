// Правила клиента — contracts/protocol.md («Правила клиента»)
import { ENGINE_VERSION, type CompositeDef, type Graph } from '@dagflow/engine';
import { describe, expect, it } from 'vitest';
import { doubleSum } from '../../engine/test/composite-fixtures';
import { graph, node } from '../../engine/test/helpers';
import { createEngineClient, type Snapshot } from '../src/client';
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from '../src/messages';

const g = (value = 1): Graph => graph([node('n', 'builtin:number', { value })]);
/** Один и тот же пустой набор: клиент сравнивает определения по ссылке. */
const NONE: CompositeDef[] = [];
const snap = (tabs: Record<string, Graph>, composites: CompositeDef[] = NONE): Snapshot => ({
  tabs: Object.entries(tabs).map(([doc, graph]) => ({ doc, graph })),
  composites,
});
const parse = (sent: string[]) => sent.map((s) => JSON.parse(s));
const host = (msg: unknown) => JSON.stringify(msg);
const welcome = { type: 'welcome', protocol: PROTOCOL_VERSION, engine: '0.0.7' };

/** Клиент после welcome со снимком; возвращает клиента и то, что он отправил после welcome. */
function connected(snapshot: Snapshot) {
  const client = createEngineClient();
  client.start();
  client.sync(snapshot);
  const out = client.receive(host(welcome));
  return { client, out };
}

describe('EngineClient: подключение', () => {
  it('start → hello с версиями', () => {
    expect(parse(createEngineClient().start())).toEqual([
      { type: 'hello', protocol: PROTOCOL_VERSION, engine: ENGINE_VERSION },
    ]);
  });

  it('до welcome ничего не отправляет', () => {
    const client = createEngineClient();
    client.start();
    expect(client.sync(snap({ t1: g() })).send).toEqual([]);
  });

  it('после welcome: ready, затем library и open всех вкладок (FR-015, FR-021)', () => {
    const composites = [doubleSum()];
    const { out } = connected(snap({ t1: g(1), t2: g(2) }, composites));
    expect(out.events).toEqual([{ kind: 'ready', protocol: PROTOCOL_VERSION, engine: '0.0.7' }]);
    expect(parse(out.send)).toEqual([
      { type: 'library', composites },
      { type: 'open', doc: 't1', rev: 1, graph: g(1) },
      { type: 'open', doc: 't2', rev: 1, graph: g(2) },
    ]);
  });

  it('welcome с другой версией протокола → incompatible, без отправки', () => {
    const client = createEngineClient();
    client.start();
    client.sync(snap({ t1: g() }));
    const out = client.receive(host({ ...welcome, protocol: PROTOCOL_VERSION + 1 }));
    expect(out.events).toEqual([
      { kind: 'incompatible', host: { protocol: PROTOCOL_VERSION + 1, engine: '0.0.7' } },
    ]);
    expect(out.send).toEqual([]);
    // Следом приходит version-mismatch — не событие сбоя
    expect(client.receive(host({ type: 'error', code: 'version-mismatch', detail: '2' }))).toEqual({
      events: [],
      send: [],
    });
  });

  it('сообщения до welcome, кроме error, игнорируются', () => {
    const client = createEngineClient();
    client.start();
    expect(client.receive(host({ type: 'pending', doc: 't1', rev: 1, nodes: ['n'] }))).toEqual({
      events: [],
      send: [],
    });
  });

  it('новое подключение (start) сбрасывает зеркала: после welcome снова полный снимок', () => {
    const { client } = connected(snap({ t1: g() }));
    client.start();
    const out = client.receive(host(welcome));
    expect(parse(out.send).map((m) => [m.type, m.rev])).toEqual([
      ['library', undefined],
      ['open', 1],
    ]);
  });
});

describe('EngineClient: синхронизация снимка', () => {
  it('US1 #5: новая вкладка → open, изменённая → update с rev + 1, исчезнувшая → close', () => {
    const { client } = connected(snap({ t1: g(1) }));
    const t1b = g(5);
    const t2 = g(2);
    expect(parse(client.sync(snap({ t1: t1b, t2 })).send)).toEqual([
      { type: 'update', doc: 't1', rev: 2, graph: t1b },
      { type: 'open', doc: 't2', rev: 1, graph: t2 },
    ]);
    expect(parse(client.sync(snap({ t2 })).send)).toEqual([{ type: 'close', doc: 't1' }]);
  });

  it('сравнение по ссылке: тот же граф не отправляется; удалённая вкладка → close', () => {
    const t1 = g(1);
    const t2 = g(2);
    const { client } = connected(snap({ t1, t2 }));
    expect(client.sync(snap({ t1, t2 })).send).toEqual([]);
    expect(parse(client.sync(snap({ t2 })).send)).toEqual([{ type: 'close', doc: 't1' }]);
  });

  it('изменённые определения составных → library', () => {
    const t1 = g();
    const { client } = connected(snap({ t1 }, [doubleSum(2)]));
    const next = [doubleSum(3)];
    expect(parse(client.sync(snap({ t1 }, next)).send)).toEqual([
      { type: 'library', composites: next },
    ]);
  });

  it('вкладка, закрытая без связи, после переподключения не передаётся (Edge Cases)', () => {
    const { client } = connected(snap({ t1: g(), t2: g(2) }));
    client.start(); // обрыв и новое подключение
    client.sync(snap({ t2: g(2) }));
    const sent = parse(client.receive(host(welcome)).send);
    expect(sent.map((m) => m.doc ?? m.type)).toEqual(['library', 't2']);
  });

  it('составной нод, изменённый без связи, приходит в library после переподключения', () => {
    const { client } = connected(snap({ t1: g() }, [doubleSum(2)]));
    client.start();
    const changed = [doubleSum(7)];
    client.sync(snap({ t1: g() }, changed));
    expect(parse(client.receive(host(welcome)).send)[0]).toEqual({
      type: 'library',
      composites: changed,
    });
  });

  it('вкладка больше лимита не отправляется: too-large по вкладке, потом sent', () => {
    const { client } = connected(snap({ t1: g() }));
    const huge = graph([node('n', 'builtin:text', { value: 'x'.repeat(MAX_MESSAGE_BYTES) })]);
    const out = client.sync(snap({ t1: huge }));
    expect(out.send).toEqual([]);
    expect(out.events).toEqual([{ kind: 'too-large', doc: 't1' }]);
    const small = g(3);
    const next = client.sync(snap({ t1: small }));
    expect(parse(next.send)).toEqual([{ type: 'update', doc: 't1', rev: 2, graph: small }]);
    expect(next.events).toEqual([{ kind: 'sent', doc: 't1' }]);
  });

  it('library больше лимита → too-large без doc', () => {
    const t1 = g();
    const { client } = connected(snap({ t1 }));
    const big = doubleSum();
    big.description = 'x'.repeat(MAX_MESSAGE_BYTES);
    const out = client.sync(snap({ t1 }, [big]));
    expect(out.send).toEqual([]);
    expect(out.events).toEqual([{ kind: 'too-large' }]);
  });
});

describe('EngineClient: сообщения хоста', () => {
  it('pending и states → события по открытой вкладке', () => {
    const { client } = connected(snap({ t1: g() }));
    const state = { status: 'ok', inputs: { value: 1 }, outputs: { value: 1 } };
    expect(
      client.receive(host({ type: 'pending', doc: 't1', rev: 1, nodes: ['n'] })).events,
    ).toEqual([{ kind: 'pending', doc: 't1', nodes: ['n'] }]);
    expect(
      client.receive(host({ type: 'states', doc: 't1', rev: 1, states: { n: state } })).events,
    ).toEqual([{ kind: 'states', doc: 't1', states: { n: state } }]);
  });

  it('pending и states по закрытой вкладке игнорируются', () => {
    const { client } = connected(snap({ t1: g() }));
    client.sync(snap({}));
    expect(
      client.receive(host({ type: 'pending', doc: 't1', rev: 1, nodes: ['n'] })).events,
    ).toEqual([]);
  });

  it('unknown-doc по открытой вкладке → resend и open заново (FR-025)', () => {
    const t1 = g();
    const { client } = connected(snap({ t1 }));
    const out = client.receive(host({ type: 'error', code: 'unknown-doc', doc: 't1' }));
    expect(out.events).toEqual([{ kind: 'resend', doc: 't1' }]);
    expect(parse(out.send)).toEqual([{ type: 'open', doc: 't1', rev: 2, graph: t1 }]);
  });

  it('unknown-doc по закрытой вкладке (ответ на close) игнорируется', () => {
    const { client } = connected(snap({ t1: g() }));
    client.sync(snap({}));
    expect(client.receive(host({ type: 'error', code: 'unknown-doc', doc: 't1' }))).toEqual({
      events: [],
      send: [],
    });
  });

  it('internal по вкладке → failed и один повтор; повторный сбой на том же графе — без повтора', () => {
    const t1 = g();
    const { client } = connected(snap({ t1 }));
    const fail = host({ type: 'error', code: 'internal', doc: 't1', detail: 'boom' });
    const first = client.receive(fail);
    expect(first.events).toEqual([{ kind: 'failed', code: 'internal', doc: 't1', retrying: true }]);
    expect(parse(first.send)).toEqual([{ type: 'open', doc: 't1', rev: 2, graph: t1 }]);
    const second = client.receive(fail);
    expect(second.events).toEqual([
      { kind: 'failed', code: 'internal', doc: 't1', retrying: false },
    ]);
    expect(second.send).toEqual([]);
    // Следующая правка — новая попытка
    const t1b = g(9);
    expect(parse(client.sync(snap({ t1: t1b })).send)).toEqual([
      { type: 'update', doc: 't1', rev: 3, graph: t1b },
    ]);
    expect(parse(client.receive(fail).send)).toEqual([
      { type: 'open', doc: 't1', rev: 4, graph: t1b },
    ]);
  });

  it('сбой без вкладки (по набору определений) → один повтор library; повторный — без повтора (FR-025)', () => {
    const composites = [doubleSum()];
    const { client } = connected(snap({ t1: g() }, composites));
    const first = client.receive(host({ type: 'error', code: 'internal', detail: 'boom' }));
    expect(first.events).toEqual([{ kind: 'failed', code: 'internal', retrying: true }]);
    expect(parse(first.send)).toEqual([{ type: 'library', composites }]);
    const second = client.receive(host({ type: 'error', code: 'invalid-message' }));
    expect(second).toEqual({
      events: [{ kind: 'failed', code: 'invalid-message', retrying: false }],
      send: [],
    });
  });

  it('too-large от хоста → failed без повтора', () => {
    const { client } = connected(snap({ t1: g() }));
    expect(client.receive(host({ type: 'error', code: 'too-large' }))).toEqual({
      events: [{ kind: 'failed', code: 'too-large', retrying: false }],
      send: [],
    });
  });

  it('невалидное сообщение хоста → failed invalid-message', () => {
    const { client } = connected(snap({ t1: g() }));
    expect(client.receive('{oops').events).toEqual([
      { kind: 'failed', code: 'invalid-message', retrying: false },
    ]);
    expect(client.receive(host({ type: 'states', doc: 't1' })).events).toEqual([
      { kind: 'failed', code: 'invalid-message', retrying: false },
    ]);
  });

  it('без лимита (Local, Worker) большая вкладка отправляется (FR-002, FR-024)', () => {
    const client = createEngineClient({ maxMessageBytes: () => undefined });
    client.start();
    const huge = graph([node('n', 'builtin:text', { value: 'x'.repeat(MAX_MESSAGE_BYTES) })]);
    client.sync(snap({ t1: huge }));
    const out = client.receive(host(welcome));
    expect(out.events.map((e) => e.kind)).toEqual(['ready']);
    expect(parse(out.send).map((m) => m.type)).toEqual(['library', 'open']);
  });

  it('отклонённая по лимиту вкладка не сериализуется заново, пока её граф не изменится', () => {
    const { client } = connected(snap({ t1: g() }));
    const huge = graph([node('n', 'builtin:text', { value: 'x'.repeat(MAX_MESSAGE_BYTES) })]);
    const t2 = g(2);
    expect(client.sync(snap({ t1: huge })).events).toEqual([{ kind: 'too-large', doc: 't1' }]);
    // Правка другой вкладки: t1 не пробуется снова — ни события, ни отправки по ней
    const other = client.sync(snap({ t1: huge, t2 }));
    expect(other.events).toEqual([]);
    expect(parse(other.send).map((m) => m.doc)).toEqual(['t2']);
  });
});

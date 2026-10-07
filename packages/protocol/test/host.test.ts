// Правила хоста — по таблице contracts/protocol.md («Правила хоста»)
import { createRegistry, ENGINE_VERSION, type Graph } from '@dagflow/engine';
import { describe, expect, it } from 'vitest';
import { def, doubleSum } from '../../engine/test/composite-fixtures';
import { edge, graph, node } from '../../engine/test/helpers';
import { createEngineHost } from '../src/host';
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION, type HostMessage } from '../src/messages';

const send = (host: ReturnType<typeof createEngineHost>, msg: unknown) =>
  host.receive(JSON.stringify(msg));

function ready() {
  const host = createEngineHost();
  send(host, { type: 'hello', protocol: PROTOCOL_VERSION, engine: ENGINE_VERSION });
  return host;
}

/** «2 + 3 → Show» */
function sumGraph(a = 2): Graph {
  return graph(
    [
      node('a', 'builtin:number', { value: a }),
      node('b', 'builtin:number', { value: 3 }),
      node('add', 'builtin:add'),
      node('show', 'builtin:show'),
    ],
    [
      edge('a', 'value', 'add', 'a'),
      edge('b', 'value', 'add', 'b'),
      edge('add', 'result', 'show', 'value'),
    ],
  );
}

const statesOf = (out: HostMessage[]) => out.flatMap((m) => (m.type === 'states' ? [m] : []));

describe('EngineHost: приём сообщений', () => {
  it('сообщение больше лимита → too-large без doc', () => {
    const host = ready();
    const out = host.receive('x'.repeat(MAX_MESSAGE_BYTES + 1));
    expect(out).toEqual([{ type: 'error', code: 'too-large' }]);
  });

  it('не JSON → invalid-message с деталью', () => {
    const out = ready().receive('{oops');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'error', code: 'invalid-message' });
    expect((out[0] as { detail?: string }).detail).toBeTruthy();
  });

  it('не прошло схему → invalid-message с путём в детали', () => {
    const out = send(ready(), { type: 'open', doc: 'tab-1', rev: 0, graph: sumGraph() });
    expect(out[0]).toMatchObject({ type: 'error', code: 'invalid-message' });
    expect((out[0] as { detail?: string }).detail).toContain('rev');
  });

  it('сообщение до hello → not-ready', () => {
    const out = send(createEngineHost(), { type: 'close', doc: 'tab-1' });
    expect(out).toEqual([{ type: 'error', code: 'not-ready' }]);
  });

  it('hello с той же версией протокола → welcome', () => {
    const host = createEngineHost();
    expect(send(host, { type: 'hello', protocol: PROTOCOL_VERSION, engine: '9.9.9' })).toEqual([
      { type: 'welcome', protocol: PROTOCOL_VERSION, engine: ENGINE_VERSION },
    ]);
    expect(host.closed).toBe(false);
  });

  it('hello с другой версией протокола → welcome, version-mismatch и закрытие', () => {
    const host = createEngineHost();
    const out = send(host, { type: 'hello', protocol: PROTOCOL_VERSION + 1, engine: '0.9.0' });
    expect(out).toEqual([
      { type: 'welcome', protocol: PROTOCOL_VERSION, engine: ENGINE_VERSION },
      { type: 'error', code: 'version-mismatch', detail: String(PROTOCOL_VERSION) },
    ]);
    expect(host.closed).toBe(true);
  });

  it('версию engine в welcome можно подменить (поддельные серверы в e2e)', () => {
    const host = createEngineHost({ engineVersion: '0.0.9' });
    expect(send(host, { type: 'hello', protocol: PROTOCOL_VERSION, engine: 'x' })).toEqual([
      { type: 'welcome', protocol: PROTOCOL_VERSION, engine: '0.0.9' },
    ]);
  });
});

describe('EngineHost: документы', () => {
  it('open нового документа → pending со всеми нодами, tick → states всех нодов', () => {
    const host = ready();
    const out = send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: sumGraph() });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'pending', doc: 'tab-1', rev: 1 });
    expect([...(out[0] as { nodes: string[] }).nodes].sort()).toEqual(['a', 'add', 'b', 'show']);
    expect(host.needsTick()).toBe(true);

    const [states] = statesOf(host.tick());
    expect(states).toMatchObject({ doc: 'tab-1', rev: 1 });
    expect(Object.keys(states!.states).sort()).toEqual(['a', 'add', 'b', 'show']);
    expect(states!.states.add!.outputs).toEqual({ result: 5 });
    expect(host.needsTick()).toBe(false);
  });

  it('повторный open открытого документа работает как update', () => {
    const host = ready();
    send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: sumGraph() });
    host.tick();
    const out = send(host, { type: 'open', doc: 'tab-1', rev: 2, graph: sumGraph(10) });
    expect(out[0]).toMatchObject({ type: 'pending', doc: 'tab-1', rev: 2 });
    expect(statesOf(host.tick())[0]!.states.add!.outputs).toEqual({ result: 13 });
  });

  it('update и close неоткрытого документа → unknown-doc с doc', () => {
    const host = ready();
    expect(send(host, { type: 'update', doc: 'nope', rev: 1, graph: sumGraph() })).toEqual([
      { type: 'error', code: 'unknown-doc', doc: 'nope' },
    ]);
    expect(send(host, { type: 'close', doc: 'nope' })).toEqual([
      { type: 'error', code: 'unknown-doc', doc: 'nope' },
    ]);
  });

  it('rev не больше последнего принятого игнорируется', () => {
    const host = ready();
    send(host, { type: 'open', doc: 'tab-1', rev: 3, graph: sumGraph() });
    host.tick();
    expect(send(host, { type: 'update', doc: 'tab-1', rev: 3, graph: sumGraph(7) })).toEqual([]);
    expect(send(host, { type: 'update', doc: 'tab-1', rev: 2, graph: sumGraph(7) })).toEqual([]);
    expect(host.needsTick()).toBe(false);
  });

  it('update без изменений — без ответа', () => {
    const host = ready();
    send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: sumGraph() });
    host.tick();
    expect(send(host, { type: 'update', doc: 'tab-1', rev: 2, graph: sumGraph() })).toEqual([]);
  });

  it('update → pending только изменившихся нодов и их потомков', () => {
    const host = ready();
    send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: sumGraph() });
    host.tick();
    const out = send(host, { type: 'update', doc: 'tab-1', rev: 2, graph: sumGraph(4) });
    expect([...(out[0] as { nodes: string[] }).nodes].sort()).toEqual(['a', 'add', 'show']);
  });

  it('несколько update до tick — один пересчёт с rev последнего (FR-016)', () => {
    const host = ready();
    send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: sumGraph() });
    host.tick();
    send(host, { type: 'update', doc: 'tab-1', rev: 2, graph: sumGraph(4) });
    send(host, { type: 'update', doc: 'tab-1', rev: 3, graph: sumGraph(5) });
    const states = statesOf(host.tick());
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({ rev: 3 });
    expect(states[0]!.states.add!.outputs).toEqual({ result: 8 });
  });

  it('close удаляет документ: после него update → unknown-doc', () => {
    const host = ready();
    send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: sumGraph() });
    expect(send(host, { type: 'close', doc: 'tab-1' })).toEqual([]);
    expect(host.needsTick()).toBe(false);
    expect(send(host, { type: 'update', doc: 'tab-1', rev: 2, graph: sumGraph() })).toEqual([
      { type: 'error', code: 'unknown-doc', doc: 'tab-1' },
    ]);
  });

  it('документы изолированы: tick шлёт states по каждому отдельно', () => {
    const host = ready();
    send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: sumGraph(1) });
    send(host, { type: 'open', doc: 'tab-2', rev: 5, graph: sumGraph(2) });
    const states = statesOf(host.tick());
    expect(states.map((s) => [s.doc, s.rev, s.states.add!.outputs.result])).toEqual([
      ['tab-1', 1, 4],
      ['tab-2', 5, 5],
    ]);
  });
});

describe('EngineHost: составные ноды', () => {
  const instGraph = graph([node('inst', 'composite:DS', { a: 1, b: 2 })]);

  it('states — только ноды верхнего уровня, экземпляр — сводное состояние', () => {
    const host = ready();
    send(host, { type: 'library', composites: [doubleSum()] });
    const out = send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: instGraph });
    expect((out[0] as { nodes: string[] }).nodes).toEqual(['inst']);
    const [states] = statesOf(host.tick());
    expect(Object.keys(states!.states)).toEqual(['inst']);
    expect(states!.states.inst).toMatchObject({ status: 'ok', outputs: { result: 6 } });
  });

  it('library пересчитывает открытые документы с текущей ревизией', () => {
    const host = ready();
    send(host, { type: 'library', composites: [doubleSum(2)] });
    send(host, { type: 'open', doc: 'tab-1', rev: 4, graph: instGraph });
    host.tick();
    const out = send(host, { type: 'library', composites: [doubleSum(10)] });
    expect(out).toEqual([{ type: 'pending', doc: 'tab-1', rev: 4, nodes: ['inst'] }]);
    expect(statesOf(host.tick())[0]!.states.inst!.outputs).toEqual({ result: 30 });
  });

  it('library без изменений для документа — без ответа', () => {
    const host = ready();
    send(host, { type: 'library', composites: [doubleSum()] });
    send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: sumGraph() });
    host.tick();
    expect(
      send(host, { type: 'library', composites: [doubleSum(), def('X', 'X', graph([]))] }),
    ).toEqual([]);
  });
});

describe('EngineHost: сбои', () => {
  it('исключение при обработке → internal с doc, соединение продолжает работу', () => {
    let fail = false;
    const host = createEngineHost({
      registry: (composites) => {
        if (fail) throw new Error('boom');
        return createRegistry(composites);
      },
    });
    send(host, { type: 'hello', protocol: PROTOCOL_VERSION, engine: ENGINE_VERSION });
    send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: sumGraph() });
    host.tick();
    fail = true;
    const out = send(host, { type: 'library', composites: [doubleSum()] });
    expect(out).toEqual([{ type: 'error', code: 'internal', detail: 'boom' }]);
    fail = false;
    expect(host.closed).toBe(false);
    expect(
      send(host, { type: 'update', doc: 'tab-1', rev: 2, graph: sumGraph(9) })[0],
    ).toMatchObject({ type: 'pending' });
  });

  it('некорректное сообщение не влияет на другие документы', () => {
    const host = ready();
    send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: sumGraph() });
    host.receive('{bad');
    expect(statesOf(host.tick())[0]!.states.add!.outputs).toEqual({ result: 5 });
  });

  it('неизвестный тип нода → ошибка этого нода, остальные считаются', () => {
    const host = ready();
    const g = graph([node('u', 'builtin:unknown'), node('n', 'builtin:number', { value: 1 })]);
    send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: g });
    const [states] = statesOf(host.tick());
    expect(states!.states.u!.status).toBe('error');
    expect(states!.states.n!.status).toBe('ok');
  });

  it('цикл (импорт старых данных) → хост не падает и не просит бесконечных тиков', () => {
    const host = ready();
    const cyclic = graph(
      [node('x', 'builtin:add'), node('y', 'builtin:add')],
      [edge('x', 'result', 'y', 'a'), edge('y', 'result', 'x', 'a')],
    );
    expect(send(host, { type: 'open', doc: 'tab-1', rev: 1, graph: cyclic })[0]).toMatchObject({
      type: 'pending',
    });
    expect(() => host.tick()).not.toThrow();
    expect(host.needsTick()).toBe(false);
  });
});

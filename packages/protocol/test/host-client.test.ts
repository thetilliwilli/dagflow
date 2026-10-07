// Клиент и хост вместе через строки: тот же результат, что Evaluator напрямую (T018)
import {
  createEvaluator,
  createRegistry,
  type CompositeDef,
  type Graph,
  type NodeState,
} from '@dagflow/engine';
import { describe, expect, it } from 'vitest';
import { doubleSum } from '../../engine/test/composite-fixtures';
import { edge, graph, node } from '../../engine/test/helpers';
import { createEngineClient, type Snapshot } from '../src/client';
import { createEngineHost } from '../src/host';

/** Прогнать обмен до тишины; вернуть итоговые состояния по вкладкам. */
function session() {
  const host = createEngineHost();
  const client = createEngineClient();
  const states: Record<string, Record<string, NodeState>> = {};
  const toHost: string[] = [...client.start()];

  function pump() {
    while (toHost.length > 0 || host.needsTick()) {
      const replies = toHost.length > 0 ? host.receive(toHost.shift()!) : host.tick();
      for (const reply of replies) {
        const out = client.receive(JSON.stringify(reply));
        toHost.push(...out.send);
        for (const e of out.events) {
          if (e.kind === 'states') Object.assign((states[e.doc] ??= {}), e.states);
        }
      }
    }
  }

  return {
    states,
    sync(snapshot: Snapshot) {
      toHost.push(...client.sync(snapshot).send);
      pump();
    },
  };
}

function direct(g: Graph, composites: CompositeDef[]) {
  const ev = createEvaluator((c) => createRegistry(c));
  ev.setGraph(g, composites);
  ev.flush();
  return Object.fromEntries(
    g.nodes.map((n) => [n.id, JSON.parse(JSON.stringify(ev.state(n.id))) as NodeState]),
  );
}

const sum = graph(
  [
    node('a', 'builtin:number', { value: 2 }),
    node('b', 'builtin:number', { value: 3 }),
    node('add', 'builtin:add'),
    node('show', 'builtin:show'),
    node('div', 'builtin:divide', { a: 1, b: 0 }),
  ],
  [
    edge('a', 'value', 'add', 'a'),
    edge('b', 'value', 'add', 'b'),
    edge('add', 'result', 'show', 'value'),
  ],
);

describe('клиент + хост', () => {
  it('«2 + 3 → Show» и ошибка нода — те же состояния, что Evaluator напрямую', () => {
    const s = session();
    s.sync({ tabs: [{ doc: 't1', graph: sum }], composites: [] });
    expect(s.states.t1).toEqual(direct(sum, []));
    expect(s.states.t1!.show!.inputs).toEqual({ value: 5 });
  });

  it('правка составного нода пересчитывает экземпляры во всех вкладках', () => {
    const inst = (id: string) => graph([node(id, 'composite:DS', { a: 1, b: 2 })]);
    const s = session();
    const g1 = inst('i1');
    const g2 = inst('i2');
    s.sync({
      tabs: [
        { doc: 't1', graph: g1 },
        { doc: 't2', graph: g2 },
      ],
      composites: [doubleSum(2)],
    });
    expect(s.states.t1!.i1!.outputs).toEqual({ result: 6 });
    s.sync({
      tabs: [
        { doc: 't1', graph: g1 },
        { doc: 't2', graph: g2 },
      ],
      composites: [doubleSum(5)],
    });
    expect(s.states.t1!.i1!.outputs).toEqual({ result: 15 });
    expect(s.states.t2!.i2!.outputs).toEqual({ result: 15 });
  });
});

import { describe, expect, it } from 'vitest';
import { createEvaluator } from '../src/evaluator';
import { createRegistry } from '../src/registry';
import type { CompositeDef, Graph } from '../src';
import { def, doubleSum, io } from './composite-fixtures';
import { edge, graph, node } from './helpers';

function run(g: Graph, defs: CompositeDef[]) {
  const ev = createEvaluator((c) => createRegistry(c));
  ev.setGraph(g, defs);
  ev.flush();
  return ev;
}

/** N1(2), N2(3) → экземпляр «Удвоенная сумма» → Show */
function withInstance(): Graph {
  return graph(
    [
      node('N1', 'builtin:number', { value: 2 }),
      node('N2', 'builtin:number', { value: 3 }),
      node('I', 'composite:DS'),
      node('Show', 'builtin:show'),
    ],
    [
      edge('N1', 'value', 'I', 'a'),
      edge('N2', 'value', 'I', 'b'),
      edge('I', 'result', 'Show', 'value'),
    ],
  );
}

describe('вычисление составных нодов', () => {
  it('E8: выходы экземпляра равны выходам развёрнутой группы', () => {
    const ev = run(withInstance(), [doubleSum()]);
    expect(ev.state('I')).toMatchObject({
      status: 'ok',
      inputs: { a: 2, b: 3 },
      outputs: { result: 10 },
    });
    expect(ev.state('Show').inputs).toEqual({ value: 10 });
    const flat = run(
      graph(
        [
          node('N1', 'builtin:number', { value: 2 }),
          node('N2', 'builtin:number', { value: 3 }),
          node('add', 'builtin:add'),
          node('mul', 'builtin:multiply', { b: 2 }),
          node('Show', 'builtin:show'),
        ],
        [
          edge('N1', 'value', 'add', 'a'),
          edge('N2', 'value', 'add', 'b'),
          edge('add', 'result', 'mul', 'a'),
          edge('mul', 'result', 'Show', 'value'),
        ],
      ),
      [],
    );
    expect(flat.state('Show').inputs).toEqual(ev.state('Show').inputs);
  });

  it('ручные значения входов экземпляра', () => {
    const ev = run(graph([{ ...node('I', 'composite:DS'), values: { a: 1, b: 1 } }]), [
      doubleSum(),
    ]);
    expect(ev.state('I').outputs).toEqual({ result: 4 });
  });

  it('вложенный составной нод вычисляется', () => {
    const outer = def('OUT', 'Внешний', {
      nodes: [
        io('i', 'builtin:input', [{ name: 'x', type: 'number', required: true }]),
        node('ds', 'composite:DS', { b: 10 }),
        io('o', 'builtin:output', [{ name: 'y', type: 'number' }]),
      ],
      edges: [edge('i', 'x', 'ds', 'a'), edge('ds', 'result', 'o', 'y')],
    });
    const ev = run(graph([{ ...node('I', 'composite:OUT'), values: { x: 5 } }]), [
      doubleSum(),
      outer,
    ]);
    expect(ev.state('I')).toMatchObject({ status: 'ok', outputs: { y: 30 } });
    expect(ev.stateAt('I/ds/mul').outputs).toEqual({ result: 30 });
  });

  it('изменение определения пересчитывает экземпляры', () => {
    const ev = createEvaluator((c) => createRegistry(c));
    const g = withInstance();
    ev.setGraph(g, [doubleSum(2)]);
    ev.flush();
    ev.setGraph(g, [doubleSum(3)]);
    expect(ev.pending().has('N1')).toBe(false);
    ev.flush();
    expect(ev.state('Show').inputs).toEqual({ value: 15 });
  });

  it('stateAt возвращает состояние внутреннего нода', () => {
    const ev = run(withInstance(), [doubleSum()]);
    expect(ev.stateAt('I/add')).toMatchObject({ status: 'ok', outputs: { result: 5 } });
  });

  it('E9: ошибка внутри → error', () => {
    const div = def('DIV', 'Деление', {
      nodes: [
        io('i', 'builtin:input', [{ name: 'b', type: 'number', required: true }]),
        node('d', 'builtin:divide', { a: 1 }),
        io('o', 'builtin:output', [{ name: 'r', type: 'number' }]),
      ],
      edges: [edge('i', 'b', 'd', 'b'), edge('d', 'result', 'o', 'r')],
    });
    const ev = run(graph([{ ...node('I', 'composite:DIV'), values: { b: 0 } }]), [div]);
    expect(ev.state('I')).toMatchObject({
      status: 'error',
      message: 'Division by zero: set a non-zero divisor.',
    });
  });

  it('E9: ошибка снаружи на входе экземпляра → blocked', () => {
    const ev = run(
      graph(
        [
          node('D', 'builtin:divide', { a: 1, b: 0 }),
          { ...node('I', 'composite:DS'), values: { b: 1 } },
        ],
        [edge('D', 'result', 'I', 'a')],
      ),
      [doubleSum()],
    );
    expect(ev.state('I').status).toBe('blocked');
  });

  it('E9: незаполненный вход экземпляра → waiting (первопричина важнее следствий)', () => {
    const ev = run(graph([{ ...node('I', 'composite:DS'), values: { b: 1 } }]), [doubleSum()]);
    expect(ev.state('I').status).toBe('waiting');
    expect(ev.state('I').message).toContain('a');
  });

  it('внутри вкладки составного нода «Вход» отдаёт значения по умолчанию', () => {
    const d = def('D', 'D', {
      nodes: [
        io('i', 'builtin:input', [{ name: 'a', type: 'number', default: 4 }]),
        node('s', 'builtin:show'),
      ],
      edges: [edge('i', 'a', 's', 'value')],
    });
    const ev = run(d.graph, [d]);
    expect(ev.state('s').inputs).toEqual({ value: 4 });
  });
});

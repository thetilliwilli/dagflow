import { describe, expect, it } from 'vitest';
import { createEvaluator } from '../../../src/engine/evaluator';
import { NodeError } from '../../../src/engine/errors';
import { createRegistry } from '../../../src/engine/registry';
import type { JsonValue, NodeRegistry, NodeTypeDef } from '../../../src/engine/types';
import { edge, graph, node } from './helpers';

/** Тестовый реестр: «src» отдаёт своё значение, «inc» прибавляет 1 и считает вызовы, «sum» складывает a и b. */
function testRegistry() {
  const calls: string[] = [];
  const defs: NodeTypeDef[] = [
    {
      id: 'test:src',
      title: 'Источник',
      category: 'test',
      description: '',
      inputs: [{ name: 'value', type: 'number', required: true }],
      outputs: [{ name: 'value', type: 'number' }],
      compute: (i) => ({ value: i.value as number }),
    },
    {
      id: 'test:inc',
      title: 'Плюс один',
      category: 'test',
      description: '',
      inputs: [{ name: 'x', type: 'number', required: true }],
      outputs: [{ name: 'y', type: 'number' }],
      compute: (i) => {
        calls.push('inc');
        return { y: (i.x as number) + 1 };
      },
    },
    {
      id: 'test:sum',
      title: 'Сумма',
      category: 'test',
      description: '',
      inputs: [
        { name: 'a', type: 'number', required: true },
        { name: 'b', type: 'number', required: true },
      ],
      outputs: [{ name: 'r', type: 'number' }],
      compute: (i) => {
        calls.push('sum');
        return { r: (i.a as number) + (i.b as number) };
      },
    },
    {
      id: 'test:boom',
      title: 'Бомба',
      category: 'test',
      description: '',
      inputs: [{ name: 'x', type: 'number', required: true }],
      outputs: [{ name: 'y', type: 'number' }],
      compute: () => {
        throw new TypeError('cannot read properties of undefined');
      },
    },
  ];
  const map = new Map(defs.map((d) => [d.id, d]));
  const registry: NodeRegistry = { get: (id) => map.get(id), list: () => defs };
  return { registry, calls };
}

describe('Evaluator', () => {
  it('вычисляет цепочку при первом flush', () => {
    const { registry } = testRegistry();
    const ev = createEvaluator(registry);
    ev.setGraph(
      graph(
        [node('S', 'test:src', { value: 1 }), node('I', 'test:inc')],
        [edge('S', 'value', 'I', 'x')],
      ),
      [],
    );
    ev.flush();
    expect(ev.state('I')).toMatchObject({ status: 'ok', outputs: { y: 2 }, inputs: { x: 1 } });
  });

  it('E1: после setValue пересчитываются только потомки', () => {
    const { registry, calls } = testRegistry();
    const ev = createEvaluator(registry);
    ev.setGraph(
      graph(
        [
          node('S1', 'test:src', { value: 1 }),
          node('I1', 'test:inc'),
          node('S2', 'test:src', { value: 5 }),
          node('I2', 'test:inc'),
        ],
        [edge('S1', 'value', 'I1', 'x'), edge('S2', 'value', 'I2', 'x')],
      ),
      [],
    );
    ev.flush();
    calls.length = 0;
    ev.setValue('S1', 'value', 10);
    const changed = ev.flush();
    expect(calls).toEqual(['inc']);
    expect([...changed.keys()].sort()).toEqual(['I1', 'S1']);
    expect(ev.state('I1').outputs).toEqual({ y: 11 });
    expect(ev.state('I2').outputs).toEqual({ y: 6 });
  });

  it('E2: «ромб» — D вычисляется ровно один раз и после B и C', () => {
    const { registry, calls } = testRegistry();
    const ev = createEvaluator(registry);
    ev.setGraph(
      graph(
        [
          node('D', 'test:sum'),
          node('B', 'test:inc'),
          node('A', 'test:src', { value: 1 }),
          node('C', 'test:inc'),
        ],
        [
          edge('A', 'value', 'B', 'x'),
          edge('A', 'value', 'C', 'x'),
          edge('B', 'y', 'D', 'a'),
          edge('C', 'y', 'D', 'b'),
        ],
      ),
      [],
    );
    ev.flush();
    expect(calls).toEqual(['inc', 'inc', 'sum']);
    calls.length = 0;
    ev.setValue('A', 'value', 10);
    ev.flush();
    expect(calls).toEqual(['inc', 'inc', 'sum']);
    expect(ev.state('D').outputs).toEqual({ r: 22 });
  });

  it('E3: порядок setValue в пакете не влияет на результат', () => {
    const run = (order: Array<[string, number]>) => {
      const { registry } = testRegistry();
      const ev = createEvaluator(registry);
      ev.setGraph(
        graph(
          [
            node('A', 'test:src', { value: 0 }),
            node('B', 'test:src', { value: 0 }),
            node('S', 'test:sum'),
          ],
          [edge('A', 'value', 'S', 'a'), edge('B', 'value', 'S', 'b')],
        ),
        [],
      );
      ev.flush();
      for (const [id, v] of order) ev.setValue(id, 'value', v);
      ev.flush();
      return ev.state('S');
    };
    expect(
      run([
        ['A', 3],
        ['B', 4],
      ]),
    ).toEqual(
      run([
        ['B', 4],
        ['A', 3],
      ]),
    );
    expect(
      run([
        ['A', 3],
        ['B', 4],
      ]).outputs,
    ).toEqual({ r: 7 });
  });

  it('E4: незаполненный обязательный вход → waiting с именем входа; потомки → blocked', () => {
    const { registry } = testRegistry();
    const ev = createEvaluator(registry);
    // Сообщение потомка называет нод по имени экземпляра (E15, фича 002)
    ev.setGraph(
      graph(
        [node('S', 'test:sum', { a: 1 }, 'Сумма'), node('I', 'test:inc')],
        [edge('S', 'r', 'I', 'x')],
      ),
      [],
    );
    ev.flush();
    expect(ev.state('S').status).toBe('waiting');
    expect(ev.state('S').message).toContain('b');
    expect(ev.state('I').status).toBe('blocked');
    expect(ev.state('I').message).toContain('Сумма');
  });

  it('E4: null, пришедший по связи, считается значением', () => {
    const registry = createRegistry([]);
    const ev = createEvaluator(registry);
    ev.setGraph(
      graph(
        [node('J', 'builtin:json', { value: null }), node('Sh', 'builtin:show')],
        [edge('J', 'value', 'Sh', 'value')],
      ),
      [],
    );
    ev.flush();
    expect(ev.state('Sh')).toMatchObject({ status: 'ok', inputs: { value: null } });
  });

  it('E5: NodeError → error, потомки → blocked, независимая ветка → ok', () => {
    const registry = createRegistry([]);
    const ev = createEvaluator(registry);
    ev.setGraph(
      graph(
        [
          node('Div', 'builtin:divide', { a: 1, b: 0 }),
          node('Show', 'builtin:show'),
          node('Add', 'builtin:add', { a: 1, b: 2 }),
          node('Show2', 'builtin:show'),
        ],
        [edge('Div', 'result', 'Show', 'value'), edge('Add', 'result', 'Show2', 'value')],
      ),
      [],
    );
    ev.flush();
    expect(ev.state('Div')).toMatchObject({
      status: 'error',
      message: 'Division by zero: set a non-zero divisor.',
    });
    expect(ev.state('Show').status).toBe('blocked');
    expect(ev.state('Show2')).toMatchObject({ status: 'ok', inputs: { value: 3 } });
  });

  it('E6: исправление значения возвращает цепочку в ok одним flush()', () => {
    const registry = createRegistry([]);
    const ev = createEvaluator(registry);
    ev.setGraph(
      graph(
        [node('Div', 'builtin:divide', { a: 1, b: 0 }), node('Show', 'builtin:show')],
        [edge('Div', 'result', 'Show', 'value')],
      ),
      [],
    );
    ev.flush();
    ev.setValue('Div', 'b', 2);
    ev.flush();
    expect(ev.state('Div')).toMatchObject({ status: 'ok', outputs: { result: 0.5 } });
    expect(ev.state('Show')).toMatchObject({ status: 'ok', inputs: { value: 0.5 } });
  });

  it('E7: неподходящее значение по порту any → error с понятным текстом', () => {
    const registry = createRegistry([]);
    const ev = createEvaluator(registry);
    ev.setGraph(
      graph(
        [
          node('J', 'builtin:json', { value: { a: 1 } }),
          node('Get', 'builtin:array-get', { index: 0 }),
        ],
        [edge('J', 'value', 'Get', 'array')],
      ),
      [],
    );
    ev.flush();
    expect(ev.state('Get')).toMatchObject({
      status: 'error',
      message: 'Expected an array, got: object.',
    });
  });

  it('исключение, не являющееся NodeError, → «Внутренняя ошибка нода» без трассировки', () => {
    const { registry } = testRegistry();
    const ev = createEvaluator(registry);
    ev.setGraph(
      graph(
        [node('S', 'test:src', { value: 1 }), node('B', 'test:boom')],
        [edge('S', 'value', 'B', 'x')],
      ),
      [],
    );
    ev.flush();
    expect(ev.state('B')).toMatchObject({
      status: 'error',
      message: 'Internal error in node “Бомба”.',
    });
  });

  it('NodeError из compute передаёт текст пользователю', () => {
    expect(new NodeError('текст').userMessage).toBe('текст');
  });

  it('pending() содержит грязные ноды и их потомков до flush()', () => {
    const { registry } = testRegistry();
    const ev = createEvaluator(registry);
    ev.setGraph(
      graph(
        [
          node('S', 'test:src', { value: 1 }),
          node('I', 'test:inc'),
          node('X', 'test:src', { value: 2 }),
        ],
        [edge('S', 'value', 'I', 'x')],
      ),
      [],
    );
    ev.flush();
    ev.setValue('S', 'value', 3);
    expect([...ev.pending()].sort()).toEqual(['I', 'S']);
    expect(ev.state('I').status).toBe('computing');
    ev.flush();
    expect(ev.pending().size).toBe(0);
  });

  it('setGraph со структурным изменением пересчитывает только затронутые ноды', () => {
    const { registry, calls } = testRegistry();
    const ev = createEvaluator(registry);
    const nodes = [
      node('S', 'test:src', { value: 1 }),
      node('I1', 'test:inc'),
      node('I2', 'test:inc'),
    ];
    ev.setGraph(graph(nodes, [edge('S', 'value', 'I1', 'x')]), []);
    ev.flush();
    expect(ev.state('I2').status).toBe('waiting');
    calls.length = 0;
    ev.setGraph(graph(nodes, [edge('S', 'value', 'I1', 'x'), edge('S', 'value', 'I2', 'x')]), []);
    ev.flush();
    expect(calls).toEqual(['inc']);
    expect(ev.state('I2').outputs).toEqual({ y: 2 });
  });

  it('удалённый нод исчезает, а его потомки переходят в waiting', () => {
    const { registry } = testRegistry();
    const ev = createEvaluator(registry);
    ev.setGraph(
      graph(
        [node('S', 'test:src', { value: 1 }), node('I', 'test:inc')],
        [edge('S', 'value', 'I', 'x')],
      ),
      [],
    );
    ev.flush();
    ev.setGraph(graph([node('I', 'test:inc')]), []);
    ev.flush();
    expect(ev.state('I').status).toBe('waiting');
  });

  it('значения возвращаются как есть (JSON)', () => {
    const registry = createRegistry([]);
    const ev = createEvaluator(registry);
    const value: JsonValue = { list: [1, 'a', null] };
    ev.setGraph(graph([node('J', 'builtin:json', { value })]), []);
    ev.flush();
    expect(ev.state('J').outputs).toEqual({ value });
  });
});

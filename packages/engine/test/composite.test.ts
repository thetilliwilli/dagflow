import { describe, expect, it } from 'vitest';
import {
  collapse,
  compositeDependencies,
  compositePorts,
  expand,
  validateIoPorts,
} from '../src/composite';
import { createRegistry } from '../src/registry';
import { canAddNode } from '../src/validate';
import type { Graph } from '../src';
import { def, doubleSum, io } from './composite-fixtures';
import { edge, graph, node } from './helpers';

let seq = 0;
const reg = createRegistry([]);
const newId = () => `x${++seq}`;

/** N1 → Add.a, N2 → Add.b, Add → Mul.a, Mul(b=2) → Show */
function sumTimesTwo(): Graph {
  return graph(
    [
      node('N1', 'builtin:number', { value: 2 }),
      node('N2', 'builtin:number', { value: 3 }),
      node('Add', 'builtin:add'),
      node('Mul', 'builtin:multiply', { b: 2 }),
      node('Show', 'builtin:show'),
    ],
    [
      edge('N1', 'value', 'Add', 'a'),
      edge('N2', 'value', 'Add', 'b'),
      edge('Add', 'result', 'Mul', 'a'),
      edge('Mul', 'result', 'Show', 'value'),
    ],
  );
}

describe('compositePorts (FR-021a, FR-021b)', () => {
  it('порты по порядку нодов «Вход»/«Выход», затем по порядку портов; один нод — несколько портов', () => {
    const d = def('D', 'D', {
      nodes: [
        io('i1', 'builtin:input', [
          { name: 'a', type: 'number', required: true },
          { name: 'b', type: 'number', default: 1 },
        ]),
        node('add', 'builtin:add'),
        io('o1', 'builtin:output', [{ name: 'result', type: 'number', required: true }]),
        io('i2', 'builtin:input', [{ name: 'c', type: 'text' }]),
      ],
      edges: [],
    });
    const p = compositePorts(d);
    expect(p.inputs).toEqual([
      { name: 'a', type: 'number', required: true },
      { name: 'b', type: 'number', default: 1 },
      { name: 'c', type: 'text' },
    ]);
    expect(p.outputs).toEqual([{ name: 'result', type: 'number' }]);
  });
});

describe('validateIoPorts (FR-021c)', () => {
  it('дубль имени среди всех нодов «Вход» отклоняется; одинаковые имена входа и выхода допустимы', () => {
    const g = graph([
      io('i1', 'builtin:input', [{ name: 'a', type: 'number' }]),
      io('i2', 'builtin:input', [{ name: 'a', type: 'text' }]),
    ]);
    const r = validateIoPorts(g);
    expect(r?.code).toBe('duplicate-port-name');
    expect(r?.message).toContain('a');
    const ok = graph([
      io('i1', 'builtin:input', [{ name: 'a', type: 'number' }]),
      io('o1', 'builtin:output', [{ name: 'a', type: 'number' }]),
    ]);
    expect(validateIoPorts(ok)).toBeNull();
  });

  it('порт с пустым именем отклоняется (003: US2 #4)', () => {
    const g = graph([io('i1', 'builtin:input', [{ name: '', type: 'number' }])]);
    expect(validateIoPorts(g)).toEqual({
      ok: false,
      code: 'duplicate-port-name',
      message: 'The port name cannot be empty.',
    });
  });
});

describe('collapse (FR-021, FR-022)', () => {
  it('создаёт «Вход»/«Выход» для внешних связей и подключает внешние связи к портам экземпляра', () => {
    const r = collapse(sumTimesTwo(), ['Add', 'Mul'], 'Удвоенная сумма', reg, newId);
    if (!('graph' in r)) throw new Error(r.message);
    const inst = r.graph.nodes.find((n) => n.type === `composite:${r.composite.id}`)!;
    expect(r.graph.nodes.map((n) => n.id).sort()).toEqual(['N1', 'N2', 'Show', inst.id].sort());
    expect(compositePorts(r.composite).inputs.map((p) => p.name)).toEqual(['a', 'b']);
    expect(compositePorts(r.composite).outputs.map((p) => p.name)).toEqual(['result']);
    const outer = r.graph.edges
      .map((e) => `${e.source.node}.${e.source.port}->${e.target.node}.${e.target.port}`)
      .sort();
    expect(outer).toEqual(
      [`${inst.id}.result->Show.value`, `N1.value->${inst.id}.a`, `N2.value->${inst.id}.b`].sort(),
    );
    const inputs = r.composite.graph.nodes.filter((n) => n.type === 'builtin:input');
    const outputs = r.composite.graph.nodes.filter((n) => n.type === 'builtin:output');
    expect(inputs).toHaveLength(2);
    expect(outputs).toHaveLength(1);
    expect(r.composite.graph.nodes.find((n) => n.id === 'Mul')!.values).toEqual({ b: 2 });
    expect(r.composite.graph.edges).toHaveLength(4);
    expect(r.composite.name).toBe('Удвоенная сумма');
  });

  it('пустое выделение и ноды «Вход»/«Выход» не сворачиваются', () => {
    expect('code' in collapse(sumTimesTwo(), [], 'X', reg, newId)).toBe(true);
    const d = doubleSum();
    expect('code' in collapse(d.graph, ['ia', 'add'], 'X', reg, newId)).toBe(true);
  });
});

describe('expand (FR-025)', () => {
  it('восстанавливает ноды и связи', () => {
    const r = collapse(sumTimesTwo(), ['Add', 'Mul'], 'Удвоенная сумма', reg, newId);
    if (!('graph' in r)) throw new Error(r.message);
    const inst = r.graph.nodes.find((n) => n.type.startsWith('composite:'))!;
    const g = expand(r.graph, inst.id, r.composite, newId);
    const types = g.nodes.map((n) => n.type).sort();
    expect(types).toEqual([
      'builtin:add',
      'builtin:multiply',
      'builtin:number',
      'builtin:number',
      'builtin:show',
    ]);
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const desc = g.edges
      .map(
        (e) =>
          `${byId.get(e.source.node)!.type}.${e.source.port}->${byId.get(e.target.node)!.type}.${e.target.port}`,
      )
      .sort();
    expect(desc).toEqual(
      [
        'builtin:add.result->builtin:multiply.a',
        'builtin:multiply.result->builtin:show.value',
        'builtin:number.value->builtin:add.a',
        'builtin:number.value->builtin:add.b',
      ].sort(),
    );
    expect(g.nodes.find((n) => n.type === 'builtin:multiply')!.values).toEqual({ b: 2 });
  });

  it('ручное значение входа экземпляра переносится на внутренний нод', () => {
    const d = doubleSum();
    const g = graph([{ ...node('I', 'composite:DS'), values: { a: 5, b: 6 } }]);
    const out = expand(g, 'I', d, newId);
    expect(out.nodes.find((n) => n.type === 'builtin:add')!.values).toEqual({ a: 5, b: 6 });
  });
});

describe('рекурсия и зависимости (FR-026)', () => {
  const C = def('C', 'C', graph([node('n', 'builtin:number')]));
  const B = def('B', 'B', graph([node('c', 'composite:C')]));
  const A = def('A', 'A', graph([node('b', 'composite:B')]));

  it('compositeDependencies возвращает транзитивные зависимости', () => {
    const deps = compositeDependencies([A, B, C]);
    expect([...deps.get('A')!].sort()).toEqual(['B', 'C']);
    expect([...deps.get('B')!]).toEqual(['C']);
    expect([...deps.get('C')!]).toEqual([]);
  });

  it('прямое и косвенное включение в себя отклоняется', () => {
    const defs = [A, B, C];
    const registry = createRegistry(defs);
    const direct = canAddNode(A.graph, 'composite:A', { insideComposite: 'A' }, registry, defs);
    expect(direct.ok).toBe(false);
    if (!direct.ok) expect(direct.code).toBe('composite-recursion');
    const indirect = canAddNode(C.graph, 'composite:A', { insideComposite: 'C' }, registry, defs);
    expect(indirect.ok).toBe(false);
    if (!indirect.ok) expect(indirect.code).toBe('composite-recursion');
    expect(canAddNode(A.graph, 'composite:C', { insideComposite: 'A' }, registry, defs).ok).toBe(
      true,
    );
  });
});

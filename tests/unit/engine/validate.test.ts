import { describe, expect, it } from 'vitest';
import { createRegistry } from '../../../src/engine/registry';
import { canAddNode, canConnect, linkCandidates, validateGraph } from '../../../src/engine/validate';
import { edge, graph, node } from './helpers';

const registry = createRegistry([]);

// Цепочка A → B → C из нодов «Сложить»
function chain() {
  return graph(
    [node('A', 'builtin:add'), node('B', 'builtin:add'), node('C', 'builtin:add')],
    [edge('A', 'result', 'B', 'a'), edge('B', 'result', 'C', 'a')],
  );
}

describe('canConnect', () => {
  it('отклоняет связь, образующую цикл (C → A)', () => {
    const r = canConnect(chain(), { source: { node: 'C', port: 'result' }, target: { node: 'A', port: 'a' } }, registry);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('cycle');
      expect(r.message).toMatch(/цикл/);
    }
  });

  it('отклоняет связь нода с самим собой', () => {
    const r = canConnect(chain(), { source: { node: 'A', port: 'result' }, target: { node: 'A', port: 'b' } }, registry);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('same-node');
  });

  it('отклоняет несовместимые типы и называет оба типа по-русски', () => {
    const g = graph([node('T', 'builtin:text'), node('S', 'builtin:add')]);
    const r = canConnect(g, { source: { node: 'T', port: 'value' }, target: { node: 'S', port: 'a' } }, registry);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('type-mismatch');
      expect(r.message).toContain('текст');
      expect(r.message).toContain('число');
    }
  });

  it('разрешает любой тип ↔ any', () => {
    const g = graph([node('T', 'builtin:text'), node('N', 'builtin:number'), node('Show', 'builtin:show'), node('J', 'builtin:json'), node('S', 'builtin:add')]);
    expect(canConnect(g, { source: { node: 'T', port: 'value' }, target: { node: 'Show', port: 'value' } }, registry).ok).toBe(true);
    expect(canConnect(g, { source: { node: 'J', port: 'value' }, target: { node: 'S', port: 'a' } }, registry).ok).toBe(true);
  });

  it('связь на занятый вход заменяет старую', () => {
    const g = chain();
    const g2 = { ...g, nodes: [...g.nodes, node('D', 'builtin:number')] };
    const old = g.edges[0]!;
    const r = canConnect(g2, { source: { node: 'D', port: 'value' }, target: { node: 'B', port: 'a' } }, registry);
    expect(r).toEqual({ ok: true, replaces: old.id });
  });

  it('несуществующий порт — unknown-port', () => {
    const r = canConnect(chain(), { source: { node: 'A', port: 'nope' }, target: { node: 'C', port: 'b' } }, registry);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('unknown-port');
  });

  it('вход нельзя использовать как источник', () => {
    const r = canConnect(chain(), { source: { node: 'A', port: 'a' }, target: { node: 'C', port: 'b' } }, registry);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('unknown-port');
  });
});

describe('canAddNode', () => {
  it('встроенный нод можно добавить', () => {
    expect(canAddNode(graph([]), 'builtin:add', {}, registry, []).ok).toBe(true);
  });

  it('неизвестный тип отклоняется', () => {
    const r = canAddNode(graph([]), 'builtin:nope', {}, registry, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('unknown-type');
  });

  it('ноды «Вход» и «Выход» вне составного нода отклоняются', () => {
    for (const t of ['builtin:input', 'builtin:output']) {
      const r = canAddNode(graph([]), t, {}, registry, []);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('io-node-outside-composite');
    }
  });
});

describe('validateGraph', () => {
  it('корректный граф — без ошибок', () => {
    expect(validateGraph(chain(), registry)).toEqual([]);
  });

  it('находит цикл', () => {
    const g = chain();
    g.edges.push(edge('C', 'result', 'A', 'a'));
    expect(validateGraph(g, registry).map((r) => r.code)).toContain('cycle');
  });

  it('находит неизвестный тип нода', () => {
    const g = graph([node('X', 'builtin:unknown')]);
    const errors = validateGraph(g, registry);
    expect(errors.map((r) => r.code)).toContain('unknown-type');
    expect(errors[0]!.message).toContain('builtin:unknown');
  });

  it('находит несовместимую связь', () => {
    const g = graph([node('T', 'builtin:text'), node('S', 'builtin:add')], [edge('T', 'value', 'S', 'a')]);
    expect(validateGraph(g, registry).map((r) => r.code)).toContain('type-mismatch');
  });

  it('находит ноды «Вход»/«Выход» вне составного нода', () => {
    const g = graph([{ ...node('I', 'builtin:input'), ports: [{ name: 'a', type: 'number', required: true }] }]);
    expect(validateGraph(g, registry).map((r) => r.code)).toContain('io-node-outside-composite');
  });
});

describe('linkCandidates (фича 002, FR-019, FR-020, E10–E12)', () => {
  // N (Число) → A → B; T — «Текст»; S — «Показать»
  function g() {
    return graph(
      [
        node('N', 'builtin:number'),
        node('T', 'builtin:text'),
        node('A', 'builtin:add'),
        node('B', 'builtin:add'),
        node('S', 'builtin:show'),
        node('X', 'composite:missing'),
      ],
      [edge('N', 'value', 'A', 'a'), edge('A', 'result', 'B', 'a')],
    );
  }
  const codes = (r: ReturnType<typeof linkCandidates>) => {
    if (!('inputs' in r)) throw new Error(r.message);
    const pick = (rec: Record<string, { ok: boolean; code?: string }>) =>
      Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, v.ok ? 'ok' : v.code]));
    return { inputs: pick(r.inputs), outputs: pick(r.outputs) };
  };
  const SAME_OUT =
    'Нельзя соединить выход с выходом: связь идёт от выхода одного нода ко входу другого.';
  const SAME_IN = 'Нельзя соединить вход со входом: связь идёт от выхода одного нода ко входу другого.';

  it('E10: запись для каждого порта цели в порядке портов, независимо от from', () => {
    const fromOut = linkCandidates(g(), { node: 'N', port: 'value', side: 'out' }, 'B', registry);
    const fromIn = linkCandidates(g(), { node: 'S', port: 'value', side: 'in' }, 'B', registry);
    for (const r of [fromOut, fromIn]) {
      if (!('inputs' in r)) throw new Error('ожидались записи');
      expect(Object.keys(r.inputs)).toEqual(['a', 'b']);
      expect(Object.keys(r.outputs)).toEqual(['result']);
    }
  });

  it('от выхода: выходы цели — same-side, вход — ok, занятый вход — ok с replaces', () => {
    const r = linkCandidates(g(), { node: 'N', port: 'value', side: 'out' }, 'B', registry);
    expect(codes(r)).toEqual({ inputs: { a: 'ok', b: 'ok' }, outputs: { result: 'same-side' } });
    if (!('inputs' in r)) return;
    expect(r.inputs.a).toEqual({ ok: true, replaces: expect.any(String) });
    expect(r.inputs.b).toEqual({ ok: true });
    expect(r.outputs.result).toEqual({ ok: false, code: 'same-side', message: SAME_OUT });
  });

  it('от выхода: несовместимый тип и цикл', () => {
    const fromText = linkCandidates(g(), { node: 'T', port: 'value', side: 'out' }, 'A', registry);
    expect(codes(fromText).inputs).toEqual({ a: 'type-mismatch', b: 'type-mismatch' });
    if ('inputs' in fromText) {
      expect(fromText.inputs.b).toMatchObject({
        message: 'Несовместимые типы: текст → число. Соедините порты одного типа или используйте порт типа «любое».',
      });
    }
    const cycle = linkCandidates(g(), { node: 'B', port: 'result', side: 'out' }, 'A', registry);
    expect(codes(cycle).inputs).toEqual({ a: 'cycle', b: 'cycle' });
    if ('inputs' in cycle) {
      expect(cycle.inputs.b).toMatchObject({
        message: 'Нельзя соединить: связь образует цикл, а граф должен оставаться без циклов.',
      });
    }
  });

  it('от входа: входы цели — same-side, выходы проверяются как источник', () => {
    const r = linkCandidates(g(), { node: 'S', port: 'value', side: 'in' }, 'B', registry);
    expect(codes(r)).toEqual({ inputs: { a: 'same-side', b: 'same-side' }, outputs: { result: 'ok' } });
    if ('inputs' in r) expect(r.inputs.a).toMatchObject({ message: SAME_IN });
    // Вход A ← выход B — цикл (A → B уже есть)
    const back = linkCandidates(g(), { node: 'A', port: 'b', side: 'in' }, 'B', registry);
    expect(codes(back).outputs).toEqual({ result: 'cycle' });
  });

  it('E12: тот же нод — все записи same-node', () => {
    const r = linkCandidates(g(), { node: 'A', port: 'result', side: 'out' }, 'A', registry);
    expect(codes(r)).toEqual({
      inputs: { a: 'same-node', b: 'same-node' },
      outputs: { result: 'same-node' },
    });
    if ('inputs' in r) {
      expect(r.inputs.a).toMatchObject({ message: 'Нельзя соединить нод с самим собой.' });
    }
  });

  it('E12: нод неизвестного типа — отказ unknown-type', () => {
    expect(linkCandidates(g(), { node: 'N', port: 'value', side: 'out' }, 'X', registry)).toEqual({
      ok: false,
      code: 'unknown-type',
      message: 'Неизвестный тип нода: composite:missing.',
    });
  });

  it('E11: совпадает с canConnect для всех портов противоположной стороны', () => {
    const graphs = g();
    for (const target of ['N', 'T', 'A', 'B', 'S']) {
      for (const [from, side] of [
        ['N', 'out'],
        ['T', 'out'],
        ['A', 'out'],
        ['B', 'out'],
      ] as const) {
        const r = linkCandidates(graphs, { node: from, port: from === 'N' || from === 'T' ? 'value' : 'result', side }, target, registry);
        if (!('inputs' in r)) throw new Error(r.message);
        for (const [port, c] of Object.entries(r.inputs)) {
          const direct = canConnect(
            graphs,
            { source: { node: from, port: from === 'N' || from === 'T' ? 'value' : 'result' }, target: { node: target, port } },
            registry,
          );
          expect(c.ok).toBe(direct.ok);
        }
      }
    }
  });
});

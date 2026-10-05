import { describe, expect, it } from 'vitest';
import { createRegistry } from '../../../src/engine/registry';
import { canAddNode, canConnect, validateGraph } from '../../../src/engine/validate';
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

import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/store/actions';
import { activeTab, tabGraph } from '../../src/store/store';
import { testStore } from './helpers';

function setup() {
  const app = testStore();
  const actions = createActions(app);
  const graph = () => tabGraph(app.store.getState(), activeTab(app.store.getState()))!;
  const add = (type: string) => {
    const r = actions.addNode(type, { x: 0, y: 0 });
    if (!r.ok) throw new Error(r.message);
    return r.id;
  };
  return { app, actions, graph, add };
}

describe('действия редактирования графа', () => {
  it('при старте есть workflow «Новый workflow» в открытой вкладке', () => {
    const { app, graph } = setup();
    const s = app.store.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.workflows[s.tabs[0]!.targetId]!.name).toBe('New workflow');
    expect(graph()).toEqual({ nodes: [], edges: [] });
  });

  it('addNode добавляет нод с типом и позицией', () => {
    const { actions, graph } = setup();
    const r = actions.addNode('builtin:add', { x: 10, y: 20 });
    expect(r.ok).toBe(true);
    expect(graph().nodes).toEqual([{ id: expect.any(String), type: 'builtin:add', name: 'Add', position: { x: 10, y: 20 }, values: {} }]);
  });

  it('addNode отклоняет «Вход» вне составного нода', () => {
    const { actions } = setup();
    const r = actions.addNode('builtin:input', { x: 0, y: 0 });
    expect(r.ok).toBe(false);
  });

  it('moveNode меняет позицию', () => {
    const { actions, graph, add } = setup();
    const id = add('builtin:number');
    actions.moveNode(id, { x: 5, y: 6 });
    expect(graph().nodes[0]!.position).toEqual({ x: 5, y: 6 });
  });

  it('deleteNodes удаляет нод и все его связи (FR-002)', () => {
    const { actions, graph, add } = setup();
    const n = add('builtin:number');
    const a = add('builtin:add');
    const sh = add('builtin:show');
    actions.connect({ node: n, port: 'value' }, { node: a, port: 'a' });
    actions.connect({ node: a, port: 'result' }, { node: sh, port: 'value' });
    actions.deleteNodes([a]);
    expect(graph().nodes.map((x) => x.id)).toEqual([n, sh]);
    expect(graph().edges).toEqual([]);
  });

  it('один выход питает несколько входов; новая связь на вход заменяет старую (FR-003)', () => {
    const { actions, graph, add } = setup();
    const n1 = add('builtin:number');
    const n2 = add('builtin:number');
    const a = add('builtin:add');
    expect(actions.connect({ node: n1, port: 'value' }, { node: a, port: 'a' }).ok).toBe(true);
    expect(actions.connect({ node: n1, port: 'value' }, { node: a, port: 'b' }).ok).toBe(true);
    expect(graph().edges).toHaveLength(2);
    expect(actions.connect({ node: n2, port: 'value' }, { node: a, port: 'a' }).ok).toBe(true);
    expect(graph().edges).toHaveLength(2);
    expect(graph().edges.find((e) => e.target.port === 'a')!.source.node).toBe(n2);
  });

  it('connect возвращает отказ движка (цикл)', () => {
    const { actions, add } = setup();
    const a = add('builtin:add');
    const b = add('builtin:add');
    actions.connect({ node: a, port: 'result' }, { node: b, port: 'a' });
    const r = actions.connect({ node: b, port: 'result' }, { node: a, port: 'a' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('cycle');
  });

  it('disconnect удаляет связь (FR-006)', () => {
    const { actions, graph, add } = setup();
    const n = add('builtin:number');
    const a = add('builtin:add');
    actions.connect({ node: n, port: 'value' }, { node: a, port: 'a' });
    actions.disconnect(graph().edges[0]!.id);
    expect(graph().edges).toEqual([]);
  });

  it('setInputValue принимает только значение подходящего типа (FR-007)', () => {
    const { actions, graph, add } = setup();
    const a = add('builtin:add');
    expect(actions.setInputValue(a, 'a', 3).ok).toBe(true);
    expect(graph().nodes[0]!.values).toEqual({ a: 3 });
    const bad = actions.setInputValue(a, 'a', 'три');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain('number');
    expect(graph().nodes[0]!.values).toEqual({ a: 3 });
    actions.setInputValue(a, 'a', undefined);
    expect(graph().nodes[0]!.values).toEqual({});
  });

  it('setInputValue для JSON-входа принимает массивы и объекты', () => {
    const { actions, graph, add } = setup();
    const j = add('builtin:json');
    expect(actions.setInputValue(j, 'value', { a: [1, null] }).ok).toBe(true);
    expect(graph().nodes[0]!.values).toEqual({ value: { a: [1, null] } });
  });
});

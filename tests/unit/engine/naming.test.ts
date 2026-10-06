// Имя экземпляра нода: нормализация, сворачивание/разворачивание, сообщения (FR-009, E13–E15)
import { describe, expect, it } from 'vitest';
import { collapse, expand } from '../../../src/engine/composite';
import { createEvaluator } from '../../../src/engine/evaluator';
import { createRegistry } from '../../../src/engine/registry';
import { normalizeNodeName } from '../../../src/engine/validate';
import { IO_INPUT, IO_OUTPUT } from '../../../src/engine/builtins/io';
import { edge, graph, node } from './helpers';

const reg = createRegistry([]);
let seq = 0;
const newId = () => `id${++seq}`;

describe('normalizeNodeName (E13)', () => {
  it('обрезает пробелы по краям', () => {
    expect(normalizeNodeName('  Итого  ')).toEqual({ ok: true, name: 'Итого' });
  });

  it('пустое имя и одни пробелы — отказ empty-name', () => {
    for (const name of ['', '   ']) {
      expect(normalizeNodeName(name)).toEqual({
        ok: false,
        code: 'empty-name',
        message: 'The node name cannot be empty. Enter at least one character.',
      });
    }
  });

  it('имя, совпадающее с названием типа, допустимо', () => {
    expect(normalizeNodeName('Сложить')).toEqual({ ok: true, name: 'Сложить' });
  });
});

/** N1 → Add ← N2, Add → Mul → Show: сворачиваем Add и Mul. */
function sample() {
  return graph(
    [
      node('N1', 'builtin:number', { value: 2 }, 'Первое'),
      node('N2', 'builtin:number', { value: 3 }, 'Второе'),
      node('Add', 'builtin:add', {}, 'Сумма'),
      node('Mul', 'builtin:multiply', { b: 2 }, 'Удвоить'),
      node('Show', 'builtin:show', {}, 'Итог'),
    ],
    [
      edge('N1', 'value', 'Add', 'a'),
      edge('N2', 'value', 'Add', 'b'),
      edge('Add', 'result', 'Mul', 'a'),
      edge('Mul', 'result', 'Show', 'value'),
    ],
  );
}

describe('имена при сворачивании и разворачивании (E14)', () => {
  it('collapse: экземпляр получает имя составного нода, «Вход»/«Выход» — названия своих типов', () => {
    const r = collapse(sample(), ['Add', 'Mul'], 'Удвоенная сумма', reg, newId);
    if (!('graph' in r)) throw new Error(r.message);
    const inst = r.graph.nodes.find((n) => n.id === r.instanceId)!;
    expect(inst.name).toBe('Удвоенная сумма');
    const io = r.composite.graph.nodes.filter((n) => n.type === IO_INPUT || n.type === IO_OUTPUT);
    expect(io.length).toBeGreaterThan(0);
    for (const n of io) expect(n.name).toBe(reg.get(n.type)!.title);
    const inner = r.composite.graph.nodes.filter(
      (n) => n.type !== IO_INPUT && n.type !== IO_OUTPUT,
    );
    expect(inner.map((n) => n.name).sort()).toEqual(['Сумма', 'Удвоить']);
  });

  it('expand сохраняет имена внутренних нодов', () => {
    const r = collapse(sample(), ['Add', 'Mul'], 'Удвоенная сумма', reg, newId);
    if (!('graph' in r)) throw new Error(r.message);
    const g = expand(r.graph, r.instanceId, r.composite, newId);
    expect(g.nodes.map((n) => n.name).sort()).toEqual(
      ['Итог', 'Первое', 'Второе', 'Сумма', 'Удвоить'].sort(),
    );
  });

  it('у каждого нода после collapse и expand непустое имя', () => {
    const r = collapse(sample(), ['Add', 'Mul'], 'Удвоенная сумма', reg, newId);
    if (!('graph' in r)) throw new Error(r.message);
    const all = [
      ...r.graph.nodes,
      ...r.composite.graph.nodes,
      ...expand(r.graph, r.instanceId, r.composite, newId).nodes,
    ];
    for (const n of all) expect(n.name.length).toBeGreaterThan(0);
  });
});

describe('сообщения о нодах выше по графу называют нод по имени (E15)', () => {
  it('waiting выше по графу', () => {
    const ev = createEvaluator(reg);
    ev.setGraph(
      graph(
        [node('A', 'builtin:add', { b: 1 }, 'Итого'), node('S', 'builtin:show', {}, 'Показ')],
        [edge('A', 'result', 'S', 'value')],
      ),
      [],
    );
    ev.flush();
    expect(ev.state('A').status).toBe('waiting');
    expect(ev.state('S')).toMatchObject({
      status: 'blocked',
      message: 'Node “Итого” upstream is waiting for inputs.',
    });
  });

  it('ошибка выше по графу', () => {
    const ev = createEvaluator(reg);
    ev.setGraph(
      graph(
        [
          node('D', 'builtin:divide', { a: 1, b: 0 }, 'Деление на ноль'),
          node('S', 'builtin:show', {}, 'Показ'),
        ],
        [edge('D', 'result', 'S', 'value')],
      ),
      [],
    );
    ev.flush();
    expect(ev.state('S')).toMatchObject({
      status: 'blocked',
      message: 'Node “Деление на ноль” upstream failed.',
    });
  });
});

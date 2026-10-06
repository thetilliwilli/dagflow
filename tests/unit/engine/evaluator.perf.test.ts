// Запас для SC-003: движок без UI пересчитывает 100 нодов меньше чем за 20 мс
import { describe, expect, it } from 'vitest';
import { createEvaluator } from '../../../src/engine/evaluator';
import { createRegistry } from '../../../src/engine/registry';
import type { Edge, NodeInstance } from '../../../src/engine';

const BUDGET_MS = 20;

function measure(nodes: NodeInstance[], edges: Edge[]): number {
  const ev = createEvaluator(createRegistry([]));
  ev.setGraph({ nodes, edges }, []);
  ev.flush();
  // прогрев JIT
  for (let i = 0; i < 5; i++) {
    ev.setValue('src', 'value', i);
    ev.flush();
  }
  const runs: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t = performance.now();
    ev.setValue('src', 'value', 100 + i);
    ev.flush();
    runs.push(performance.now() - t);
  }
  return runs.sort((a, b) => a - b)[Math.floor(runs.length / 2)]!; // медиана
}

const pos = { x: 0, y: 0 };

describe('производительность движка (SC-003)', () => {
  it('цепочка из 100 нодов', () => {
    const nodes: NodeInstance[] = [{ id: 'src', type: 'builtin:number', name: 'Number', position: pos, values: { value: 1 } }];
    const edges: Edge[] = [];
    for (let i = 1; i < 100; i++) {
      nodes.push({ id: `n${i}`, type: 'builtin:add', name: `Add ${i}`, position: pos, values: { b: 1 } });
      edges.push({ id: `e${i}`, source: { node: i === 1 ? 'src' : `n${i - 1}`, port: i === 1 ? 'value' : 'result' }, target: { node: `n${i}`, port: 'a' } });
    }
    const ms = measure(nodes, edges);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('«широкий» граф: один источник и 99 потребителей', () => {
    const nodes: NodeInstance[] = [{ id: 'src', type: 'builtin:number', name: 'Number', position: pos, values: { value: 1 } }];
    const edges: Edge[] = [];
    for (let i = 1; i < 100; i++) {
      nodes.push({ id: `n${i}`, type: 'builtin:multiply', name: `Multiply ${i}`, position: pos, values: { b: i } });
      edges.push({ id: `e${i}`, source: { node: 'src', port: 'value' }, target: { node: `n${i}`, port: 'a' } });
    }
    const ms = measure(nodes, edges);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});

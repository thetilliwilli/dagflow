// Пучки связей: одна линия на пару нодов и подпись «выход→вход» (FR-023, FR-024, SC-004)
import { describe, expect, it } from 'vitest';
import type { Edge } from '../../../src/engine';
import { bundleEdges, bundleLabel } from '../../../src/ui/canvas/bundles';

const e = (id: string, s: string, sp: string, t: string, tp: string): Edge => ({
  id,
  source: { node: s, port: sp },
  target: { node: t, port: tp },
});

describe('bundleEdges', () => {
  it('один пучок на упорядоченную пару, связи — в порядке графа', () => {
    const edges = [
      e('1', 'A', 'result', 'B', 'day'),
      e('2', 'C', 'value', 'B', 'x'),
      e('3', 'A', 'result', 'B', 'run'),
      e('4', 'B', 'result', 'D', 'a'),
    ];
    const bundles = bundleEdges(edges);
    expect(bundles.map((b) => b.id)).toEqual(['bundle:A->B', 'bundle:C->B', 'bundle:B->D']);
    expect(bundles[0]).toEqual({
      id: 'bundle:A->B',
      source: 'A',
      target: 'B',
      edges: [edges[0], edges[2]],
    });
  });

  it('SC-004: линий не больше, чем пар нодов со связями', () => {
    const edges = Array.from({ length: 12 }, (_, i) => e(`${i}`, 'A', `o${i % 3}`, 'B', `i${i}`));
    expect(bundleEdges(edges)).toHaveLength(1);
    expect(bundleEdges([])).toEqual([]);
  });
});

describe('bundleLabel', () => {
  it('строки «выход→вход» по одной на связь', () => {
    const [b] = bundleEdges([e('1', 'A', 'result', 'B', 'day'), e('2', 'A', 'result', 'B', 'run')]);
    expect(bundleLabel(b!)).toEqual(['result→day', 'result→run']);
  });

  it('больше 5 связей — первые 5 и «ещё N»', () => {
    const [b] = bundleEdges(Array.from({ length: 8 }, (_, i) => e(`${i}`, 'A', 'o', 'B', `i${i}`)));
    expect(bundleLabel(b!)).toEqual(['o→i0', 'o→i1', 'o→i2', 'o→i3', 'o→i4', '+3 more']);
  });
});

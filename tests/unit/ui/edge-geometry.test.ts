// Концы прямой линии — на рамках карточек (research R2)
import { describe, expect, it } from 'vitest';
import { borderPoint } from '../../../src/ui/canvas/edge-geometry';

const rect = { x: 0, y: 0, width: 200, height: 100 }; // центр (100, 50)

describe('borderPoint', () => {
  it('цель справа, слева, сверху, снизу', () => {
    expect(borderPoint(rect, { x: 500, y: 50 })).toEqual({ x: 200, y: 50 });
    expect(borderPoint(rect, { x: -300, y: 50 })).toEqual({ x: 0, y: 50 });
    expect(borderPoint(rect, { x: 100, y: -400 })).toEqual({ x: 100, y: 0 });
    expect(borderPoint(rect, { x: 100, y: 900 })).toEqual({ x: 100, y: 100 });
  });

  it('по диагонали — точка на рамке и на прямой между центрами', () => {
    const p = borderPoint(rect, { x: 400, y: 350 }); // направление (300, 300)
    expect(p).toEqual({ x: 150, y: 100 });
    const flat = borderPoint(rect, { x: 700, y: 110 }); // (600, 60): упирается в правую сторону
    expect(flat.x).toBe(200);
    expect(flat.y).toBeCloseTo(60);
  });

  it('цель в центре — сам центр', () => {
    expect(borderPoint(rect, { x: 100, y: 50 })).toEqual({ x: 100, y: 50 });
  });
});

// Положение плавающих окон: ограничение вьюпортом и места по умолчанию (FR-003, research R6)
import { describe, expect, it } from 'vitest';
import {
  clampToViewport,
  defaultPosition,
  peekPosition,
  TOP_BAR_HEIGHT,
} from '../../../src/ui/floating/geometry';

const viewport = { width: 1000, height: 800 };

describe('clampToViewport', () => {
  it('окно внутри не меняется', () => {
    expect(clampToViewport({ x: 10, y: 20, width: 200, height: 100 }, viewport)).toEqual({
      x: 10,
      y: 20,
    });
  });

  it('вышло за правый и нижний край — возвращается внутрь', () => {
    expect(clampToViewport({ x: 950, y: 790, width: 200, height: 100 }, viewport)).toEqual({
      x: 800,
      y: 700,
    });
  });

  it('вышло за левый и верхний край — возвращается внутрь', () => {
    expect(clampToViewport({ x: -50, y: -10, width: 200, height: 100 }, viewport)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('окно больше вьюпорта прижимается к левому верхнему углу', () => {
    expect(clampToViewport({ x: 300, y: 300, width: 1200, height: 900 }, viewport)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('defaultPosition', () => {
  const size = { width: 300, height: 400 };

  it('левая панель — у левого края под кнопкой меню', () => {
    const p = defaultPosition('sidebar', size, viewport);
    expect(p.x).toBeLessThan(20);
    expect(p.y).toBeGreaterThanOrEqual(TOP_BAR_HEIGHT);
  });

  it('палитра — внизу по центру', () => {
    expect(defaultPosition('palette', size, viewport)).toEqual({ x: 350, y: 384 });
  });

  it('окно свойств — у правого края под полосой вкладок', () => {
    const p = defaultPosition('properties', size, viewport);
    expect(p.x + size.width).toBeGreaterThan(viewport.width - 20);
    expect(p.x + size.width).toBeLessThanOrEqual(viewport.width);
    expect(p.y).toBeGreaterThanOrEqual(TOP_BAR_HEIGHT);
  });

  it('положение по умолчанию тоже внутри вьюпорта', () => {
    for (const id of ['sidebar', 'palette', 'properties', 'edges'] as const) {
      const p = defaultPosition(id, { width: 2000, height: 2000 }, viewport);
      expect(p).toEqual({ x: 0, y: 0 });
    }
  });
});

describe('peekPosition (временное окно при связывании, FR-018)', () => {
  const win = { width: 300, height: 200 };
  const vp = { width: 1000, height: 800 };

  it('справа от нода, если места справа больше', () => {
    const p = peekPosition({ x: 100, y: 100, width: 150, height: 80 }, win, vp);
    expect(p.x).toBeGreaterThanOrEqual(250);
    expect(p.y).toBe(100);
  });

  it('слева от нода, если места слева больше', () => {
    const p = peekPosition({ x: 700, y: 300, width: 150, height: 80 }, win, vp);
    expect(p.x + win.width).toBeLessThanOrEqual(700);
  });

  it('не перекрывает нод и остаётся во вьюпорте', () => {
    const node = { x: 400, y: 700, width: 150, height: 80 };
    const p = peekPosition(node, win, vp);
    const overlaps =
      p.x < node.x + node.width &&
      p.x + win.width > node.x &&
      p.y < node.y + node.height &&
      p.y + win.height > node.y;
    expect(overlaps).toBe(false);
    expect(p.y + win.height).toBeLessThanOrEqual(vp.height);
    expect(p.x).toBeGreaterThanOrEqual(0);
  });
});

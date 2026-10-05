// Положение плавающих окон: ограничение вьюпортом и места по умолчанию (FR-003, research R6)
import { describe, expect, it } from 'vitest';
import {
  clampToViewport,
  defaultPosition,
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

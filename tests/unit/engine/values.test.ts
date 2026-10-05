import { describe, expect, it } from 'vitest';
import { deepEqual, describeKind, isCompatible, matchesType } from '../../../src/engine/values';
import type { PortType } from '../../../src/engine/types';

describe('matchesType', () => {
  it('number — только конечные числа', () => {
    expect(matchesType(1.5, 'number')).toBe(true);
    expect(matchesType(NaN, 'number')).toBe(false);
    expect(matchesType(Infinity, 'number')).toBe(false);
    expect(matchesType('1', 'number')).toBe(false);
  });

  it('text, boolean', () => {
    expect(matchesType('', 'text')).toBe(true);
    expect(matchesType(1, 'text')).toBe(false);
    expect(matchesType(false, 'boolean')).toBe(true);
    expect(matchesType(0, 'boolean')).toBe(false);
  });

  it('array — массив, object — объект, но не массив и не null', () => {
    expect(matchesType([], 'array')).toBe(true);
    expect(matchesType({}, 'array')).toBe(false);
    expect(matchesType({}, 'object')).toBe(true);
    expect(matchesType([], 'object')).toBe(false);
    expect(matchesType(null, 'object')).toBe(false);
  });

  it('null допустим только для any', () => {
    const types: PortType[] = ['number', 'text', 'boolean', 'array', 'object'];
    for (const t of types) expect(matchesType(null, t)).toBe(false);
    expect(matchesType(null, 'any')).toBe(true);
    expect(matchesType({ a: [1, 'x', null] }, 'any')).toBe(true);
  });
});

describe('isCompatible', () => {
  const types: PortType[] = ['number', 'text', 'boolean', 'array', 'object', 'any'];
  for (const a of types) {
    for (const b of types) {
      const expected = a === b || a === 'any' || b === 'any';
      it(`${a} → ${b}: ${expected}`, () => {
        expect(isCompatible(a, b)).toBe(expected);
      });
    }
  }
});

describe('deepEqual', () => {
  it('порядок ключей объекта не важен', () => {
    expect(deepEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
  });
  it('порядок элементов массива важен', () => {
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });
  it('разные типы не равны', () => {
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual([], {})).toBe(false);
  });
  it('вложенные структуры', () => {
    expect(deepEqual({ x: { y: [null, true] } }, { x: { y: [null, true] } })).toBe(true);
    expect(deepEqual({ x: 1 }, { x: 1, y: 2 })).toBe(false);
  });
});

describe('describeKind', () => {
  it('называет вид значения по-русски', () => {
    expect(describeKind(1)).toBe('число');
    expect(describeKind('a')).toBe('текст');
    expect(describeKind(true)).toBe('логическое значение');
    expect(describeKind([])).toBe('массив');
    expect(describeKind({})).toBe('объект');
    expect(describeKind(null)).toBe('null');
  });
});

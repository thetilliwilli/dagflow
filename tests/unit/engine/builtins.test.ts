import { describe, expect, it } from 'vitest';
import { builtinNodes } from '../../../src/engine/builtins';
import { NodeError } from '../../../src/engine/errors';
import type { Inputs, JsonValue, NodeTypeDef } from '../../../src/engine/types';

function def(id: string): NodeTypeDef {
  const d = builtinNodes.find((n) => n.id === id);
  if (!d) throw new Error(`нет нода ${id}`);
  return d;
}

function run(id: string, inputs: Inputs): Record<string, JsonValue> {
  return def(id).compute!(inputs);
}

function errorOf(id: string, inputs: Inputs): string {
  try {
    run(id, inputs);
  } catch (e) {
    if (e instanceof NodeError) return e.userMessage;
    throw e;
  }
  throw new Error('ожидалась ошибка');
}

function ports(id: string) {
  const d = def(id);
  return {
    inputs: d.inputs.map((p) => `${p.name}${p.required ? '*' : ''}:${p.type}${p.default !== undefined ? `=${JSON.stringify(p.default)}` : ''}`),
    outputs: d.outputs.map((p) => `${p.name}:${p.type}`),
  };
}

describe('каталог', () => {
  it('содержит все ноды из contracts/builtin-nodes.md', () => {
    const ids = builtinNodes.map((n) => n.id).sort();
    expect(ids).toEqual(
      [
        'builtin:number', 'builtin:text', 'builtin:boolean', 'builtin:json',
        'builtin:add', 'builtin:subtract', 'builtin:multiply', 'builtin:divide',
        'builtin:concat', 'builtin:text-length', 'builtin:to-text', 'builtin:to-number',
        'builtin:equals', 'builtin:greater', 'builtin:less', 'builtin:and', 'builtin:or', 'builtin:not',
        'builtin:if',
        'builtin:array-append', 'builtin:array-get', 'builtin:array-length', 'builtin:object-set', 'builtin:object-get',
        'builtin:show',
      ].sort(),
    );
  });

  it('у каждого нода есть название, категория и описание', () => {
    for (const n of builtinNodes) {
      expect(n.title).not.toBe('');
      expect(n.category).not.toBe('');
      expect(n.description).not.toBe('');
    }
  });
});

describe('константы', () => {
  it('порты', () => {
    expect(ports('builtin:number')).toEqual({ inputs: ['value:number=0'], outputs: ['value:number'] });
    expect(ports('builtin:text')).toEqual({ inputs: ['value:text=""'], outputs: ['value:text'] });
    expect(ports('builtin:boolean')).toEqual({ inputs: ['value:boolean=false'], outputs: ['value:boolean'] });
    expect(ports('builtin:json')).toEqual({ inputs: ['value:any=null'], outputs: ['value:any'] });
  });
  it('возвращают значение входа', () => {
    expect(run('builtin:number', { value: 7 })).toEqual({ value: 7 });
    expect(run('builtin:json', { value: [1] })).toEqual({ value: [1] });
  });
});

describe('арифметика', () => {
  it('порты', () => {
    for (const id of ['builtin:add', 'builtin:subtract', 'builtin:multiply', 'builtin:divide']) {
      expect(ports(id)).toEqual({ inputs: ['a*:number', 'b*:number'], outputs: ['result:number'] });
    }
  });
  it('вычисления', () => {
    expect(run('builtin:add', { a: 2, b: 3 })).toEqual({ result: 5 });
    expect(run('builtin:subtract', { a: 2, b: 3 })).toEqual({ result: -1 });
    expect(run('builtin:multiply', { a: 2, b: 3 })).toEqual({ result: 6 });
    expect(run('builtin:divide', { a: 3, b: 2 })).toEqual({ result: 1.5 });
  });
  it('деление на ноль', () => {
    expect(errorOf('builtin:divide', { a: 1, b: 0 })).toBe('Деление на ноль: задайте ненулевой делитель');
  });
  it('слишком большой результат', () => {
    expect(errorOf('builtin:multiply', { a: 1e308, b: 10 })).toBe('Результат слишком большой');
  });
});

describe('текст', () => {
  it('порты', () => {
    expect(ports('builtin:concat')).toEqual({ inputs: ['a*:text', 'b*:text'], outputs: ['result:text'] });
    expect(ports('builtin:text-length')).toEqual({ inputs: ['text*:text'], outputs: ['length:number'] });
    expect(ports('builtin:to-text')).toEqual({ inputs: ['value*:any'], outputs: ['text:text'] });
    expect(ports('builtin:to-number')).toEqual({ inputs: ['text*:text'], outputs: ['value:number'] });
  });
  it('вычисления', () => {
    expect(run('builtin:concat', { a: 'ab', b: 'c' })).toEqual({ result: 'abc' });
    expect(run('builtin:text-length', { text: 'привет' })).toEqual({ length: 6 });
    expect(run('builtin:to-text', { value: 'x' })).toEqual({ text: 'x' });
    expect(run('builtin:to-text', { value: { a: [1, 2] } })).toEqual({ text: '{"a":[1,2]}' });
    expect(run('builtin:to-number', { text: ' 42.5 ' })).toEqual({ value: 42.5 });
  });
  it('не число', () => {
    expect(errorOf('builtin:to-number', { text: 'abc' })).toBe('"abc" не является числом');
    expect(errorOf('builtin:to-number', { text: '' })).toBe('"" не является числом');
  });
});

describe('сравнение и логика', () => {
  it('порты', () => {
    expect(ports('builtin:equals')).toEqual({ inputs: ['a*:any', 'b*:any'], outputs: ['result:boolean'] });
    expect(ports('builtin:greater')).toEqual({ inputs: ['a*:number', 'b*:number'], outputs: ['result:boolean'] });
    expect(ports('builtin:and')).toEqual({ inputs: ['a*:boolean', 'b*:boolean'], outputs: ['result:boolean'] });
    expect(ports('builtin:not')).toEqual({ inputs: ['value*:boolean'], outputs: ['result:boolean'] });
    expect(ports('builtin:if')).toEqual({ inputs: ['condition*:boolean', 'then*:any', 'else*:any'], outputs: ['result:any'] });
  });
  it('вычисления', () => {
    expect(run('builtin:equals', { a: { x: 1, y: 2 }, b: { y: 2, x: 1 } })).toEqual({ result: true });
    expect(run('builtin:greater', { a: 2, b: 1 })).toEqual({ result: true });
    expect(run('builtin:less', { a: 2, b: 1 })).toEqual({ result: false });
    expect(run('builtin:and', { a: true, b: false })).toEqual({ result: false });
    expect(run('builtin:or', { a: true, b: false })).toEqual({ result: true });
    expect(run('builtin:not', { value: true })).toEqual({ result: false });
    expect(run('builtin:if', { condition: false, then: 1, else: 'b' })).toEqual({ result: 'b' });
  });
});

describe('массивы и объекты', () => {
  it('порты', () => {
    expect(ports('builtin:array-append')).toEqual({ inputs: ['array:array=[]', 'item*:any'], outputs: ['array:array'] });
    expect(ports('builtin:array-get')).toEqual({ inputs: ['array*:any', 'index*:number'], outputs: ['item:any'] });
    expect(ports('builtin:array-length')).toEqual({ inputs: ['array*:array'], outputs: ['length:number'] });
    expect(ports('builtin:object-set')).toEqual({ inputs: ['object:object={}', 'key*:text', 'value*:any'], outputs: ['object:object'] });
    expect(ports('builtin:object-get')).toEqual({ inputs: ['object*:any', 'key*:text'], outputs: ['value:any'] });
  });
  it('вычисления не мутируют входы', () => {
    const arr = [1];
    expect(run('builtin:array-append', { array: arr, item: 2 })).toEqual({ array: [1, 2] });
    expect(arr).toEqual([1]);
    const obj = { a: 1 };
    expect(run('builtin:object-set', { object: obj, key: 'b', value: 2 })).toEqual({ object: { a: 1, b: 2 } });
    expect(obj).toEqual({ a: 1 });
    expect(run('builtin:array-get', { array: ['x', 'y'], index: 1 })).toEqual({ item: 'y' });
    expect(run('builtin:array-length', { array: [1, 2, 3] })).toEqual({ length: 3 });
    expect(run('builtin:object-get', { object: { k: null }, key: 'k' })).toEqual({ value: null });
  });
  it('ошибки', () => {
    expect(errorOf('builtin:array-get', { array: 'abc', index: 0 })).toBe('Ожидался массив, получено: текст');
    expect(errorOf('builtin:array-get', { array: [1], index: 5 })).toBe('Индекс 5 вне диапазона: в массиве 1 элемент');
    expect(errorOf('builtin:array-get', { array: [1], index: 0.5 })).toBe('Индекс должен быть целым числом, получено: 0.5');
    expect(errorOf('builtin:object-get', { object: [1], key: 'a' })).toBe('Ожидался объект, получено: массив');
    expect(errorOf('builtin:object-get', { object: { a: 1 }, key: 'b' })).toBe('Поле "b" не найдено');
  });
});

describe('отображение', () => {
  it('«Показать» — один вход, без выходов', () => {
    expect(ports('builtin:show')).toEqual({ inputs: ['value*:any'], outputs: [] });
    expect(run('builtin:show', { value: 5 })).toEqual({});
  });
});

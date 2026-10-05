import { NodeError, plural } from '../errors';
import type { JsonValue } from '../types';
import { describeKind, isPlainObject } from '../values';
import { categories, defineNode, out, req } from './define';

const c = categories.collections;

function expectArray(value: JsonValue): JsonValue[] {
  if (!Array.isArray(value)) throw new NodeError(`Ожидался массив, получено: ${describeKind(value)}`);
  return value;
}

function expectObject(value: JsonValue): { [key: string]: JsonValue } {
  if (!isPlainObject(value)) throw new NodeError(`Ожидался объект, получено: ${describeKind(value)}`);
  return value;
}

export const collectionNodes = [
  defineNode({
    id: 'builtin:array-append',
    title: 'Добавить в массив',
    category: c,
    description: 'Новый массив с элементом в конце.',
    inputs: [{ name: 'array', type: 'array', default: [] }, req('item', 'any')],
    outputs: [out('array', 'array')],
    compute: (i) => ({ array: [...(i.array as JsonValue[]), i.item!] }),
  }),
  defineNode({
    id: 'builtin:array-get',
    title: 'Элемент массива',
    category: c,
    description: 'Элемент массива по индексу (с нуля).',
    inputs: [req('array', 'any'), req('index', 'number')],
    outputs: [out('item', 'any')],
    compute: (i) => {
      const array = expectArray(i.array!);
      const index = i.index as number;
      if (!Number.isInteger(index)) throw new NodeError(`Индекс должен быть целым числом, получено: ${index}`);
      if (index < 0 || index >= array.length) {
        const n = array.length;
        throw new NodeError(`Индекс ${index} вне диапазона: в массиве ${n} ${plural(n, 'элемент', 'элемента', 'элементов')}`);
      }
      return { item: array[index]! };
    },
  }),
  defineNode({
    id: 'builtin:array-length',
    title: 'Длина массива',
    category: c,
    description: 'Количество элементов в массиве.',
    inputs: [req('array', 'array')],
    outputs: [out('length', 'number')],
    compute: (i) => ({ length: (i.array as JsonValue[]).length }),
  }),
  defineNode({
    id: 'builtin:object-set',
    title: 'Установить поле',
    category: c,
    description: 'Новый объект с заданным полем.',
    inputs: [{ name: 'object', type: 'object', default: {} }, req('key', 'text'), req('value', 'any')],
    outputs: [out('object', 'object')],
    compute: (i) => ({ object: { ...(i.object as { [key: string]: JsonValue }), [i.key as string]: i.value! } }),
  }),
  defineNode({
    id: 'builtin:object-get',
    title: 'Поле объекта',
    category: c,
    description: 'Значение поля объекта по имени.',
    inputs: [req('object', 'any'), req('key', 'text')],
    outputs: [out('value', 'any')],
    compute: (i) => {
      const object = expectObject(i.object!);
      const key = i.key as string;
      if (!Object.hasOwn(object, key)) throw new NodeError(`Поле "${key}" не найдено`);
      return { value: object[key]! };
    },
  }),
];

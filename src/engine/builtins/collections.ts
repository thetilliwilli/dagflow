import { NodeError, nodeErrors } from '../errors';
import type { JsonValue } from '../types';
import { describeKind, isPlainObject } from '../values';
import { categories, defineNode, out, req } from './define';

const c = categories.collections;

function expectArray(value: JsonValue): JsonValue[] {
  if (!Array.isArray(value)) throw new NodeError(nodeErrors.expectedArray(describeKind(value)));
  return value;
}

function expectObject(value: JsonValue): { [key: string]: JsonValue } {
  if (!isPlainObject(value)) throw new NodeError(nodeErrors.expectedObject(describeKind(value)));
  return value;
}

export const collectionNodes = [
  defineNode({
    id: 'builtin:array-append',
    title: 'Append to array',
    category: c,
    description: 'A new array with the item added at the end.',
    inputs: [{ name: 'array', type: 'array', default: [] }, req('item', 'any')],
    outputs: [out('array', 'array')],
    compute: (i) => ({ array: [...(i.array as JsonValue[]), i.item!] }),
  }),
  defineNode({
    id: 'builtin:array-get',
    title: 'Array item',
    category: c,
    description: 'Array item by index (from zero).',
    inputs: [req('array', 'any'), req('index', 'number')],
    outputs: [out('item', 'any')],
    compute: (i) => {
      const array = expectArray(i.array!);
      const index = i.index as number;
      if (!Number.isInteger(index)) throw new NodeError(nodeErrors.indexNotInteger(index));
      if (index < 0 || index >= array.length) {
        throw new NodeError(nodeErrors.indexOutOfRange(index, array.length));
      }
      return { item: array[index]! };
    },
  }),
  defineNode({
    id: 'builtin:array-length',
    title: 'Array length',
    category: c,
    description: 'Number of items in the array.',
    inputs: [req('array', 'array')],
    outputs: [out('length', 'number')],
    compute: (i) => ({ length: (i.array as JsonValue[]).length }),
  }),
  defineNode({
    id: 'builtin:object-set',
    title: 'Set field',
    category: c,
    description: 'A new object with the field set.',
    inputs: [
      { name: 'object', type: 'object', default: {} },
      req('key', 'text'),
      req('value', 'any'),
    ],
    outputs: [out('object', 'object')],
    compute: (i) => ({
      object: { ...(i.object as { [key: string]: JsonValue }), [i.key as string]: i.value! },
    }),
  }),
  defineNode({
    id: 'builtin:object-get',
    title: 'Object field',
    category: c,
    description: 'Value of an object field by name.',
    inputs: [req('object', 'any'), req('key', 'text')],
    outputs: [out('value', 'any')],
    compute: (i) => {
      const object = expectObject(i.object!);
      const key = i.key as string;
      if (!Object.hasOwn(object, key)) throw new NodeError(nodeErrors.fieldNotFound(key));
      return { value: object[key]! };
    },
  }),
];

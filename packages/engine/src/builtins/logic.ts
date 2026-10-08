import { deepEqual } from '../values';
import { categories, defineNode, out, req } from './define';

const c = categories.logic;

export const logicNodes = [
  defineNode({
    id: 'builtin:equals',
    title: 'Equals',
    category: c,
    description: 'Checks that a and b are equal (including nested arrays and objects).',
    inputs: [req('a', 'any'), req('b', 'any')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: deepEqual(i.a!, i.b!) }),
  }),
  defineNode({
    id: 'builtin:greater',
    title: 'Greater than',
    category: c,
    description: 'a > b',
    inputs: [req('a', 'number'), req('b', 'number')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: (i.a as number) > (i.b as number) }),
  }),
  defineNode({
    id: 'builtin:less',
    title: 'Less than',
    category: c,
    description: 'a < b',
    inputs: [req('a', 'number'), req('b', 'number')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: (i.a as number) < (i.b as number) }),
  }),
  defineNode({
    id: 'builtin:and',
    title: 'And',
    category: c,
    description: 'True if both values are true.',
    inputs: [req('a', 'boolean'), req('b', 'boolean')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: (i.a as boolean) && (i.b as boolean) }),
  }),
  defineNode({
    id: 'builtin:or',
    title: 'Or',
    category: c,
    description: 'True if at least one value is true.',
    inputs: [req('a', 'boolean'), req('b', 'boolean')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: (i.a as boolean) || (i.b as boolean) }),
  }),
  defineNode({
    id: 'builtin:not',
    title: 'Not',
    category: c,
    description: 'Inverts a boolean.',
    inputs: [req('value', 'boolean')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: !(i.value as boolean) }),
  }),
  defineNode({
    id: 'builtin:if',
    title: 'If',
    category: categories.condition,
    description: 'Picks “then” if the condition is true, otherwise “else”.',
    inputs: [req('condition', 'boolean'), req('then', 'any'), req('else', 'any')],
    outputs: [out('result', 'any')],
    compute: (i) => ({ result: i.condition ? i.then! : i.else! }),
  }),
];

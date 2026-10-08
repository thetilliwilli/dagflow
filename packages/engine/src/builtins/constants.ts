import { categories, defineNode, out } from './define';

const c = categories.constants;

export const constantNodes = [
  defineNode({
    id: 'builtin:number',
    title: 'Number',
    category: c,
    description: 'Sets a number manually.',
    inputs: [{ name: 'value', type: 'number', default: 0 }],
    outputs: [out('value', 'number')],
    compute: (i) => ({ value: i.value! }),
  }),
  defineNode({
    id: 'builtin:text',
    title: 'Text',
    category: c,
    description: 'Sets text manually.',
    inputs: [{ name: 'value', type: 'text', default: '' }],
    outputs: [out('value', 'text')],
    compute: (i) => ({ value: i.value! }),
  }),
  defineNode({
    id: 'builtin:boolean',
    title: 'Boolean',
    category: c,
    description: 'Sets a boolean: yes or no.',
    inputs: [{ name: 'value', type: 'boolean', default: false }],
    outputs: [out('value', 'boolean')],
    compute: (i) => ({ value: i.value! }),
  }),
  defineNode({
    id: 'builtin:json',
    title: 'JSON value',
    category: c,
    description: 'Sets any JSON value: array, object, null, etc.',
    inputs: [{ name: 'value', type: 'any', default: null }],
    outputs: [out('value', 'any')],
    compute: (i) => ({ value: i.value! }),
  }),
];

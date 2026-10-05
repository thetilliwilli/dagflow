import { categories, defineNode, out } from './define';

const c = categories.constants;

export const constantNodes = [
  defineNode({
    id: 'builtin:number',
    title: 'Число',
    category: c,
    description: 'Задаёт число вручную.',
    inputs: [{ name: 'value', type: 'number', default: 0 }],
    outputs: [out('value', 'number')],
    compute: (i) => ({ value: i.value! }),
  }),
  defineNode({
    id: 'builtin:text',
    title: 'Текст',
    category: c,
    description: 'Задаёт текст вручную.',
    inputs: [{ name: 'value', type: 'text', default: '' }],
    outputs: [out('value', 'text')],
    compute: (i) => ({ value: i.value! }),
  }),
  defineNode({
    id: 'builtin:boolean',
    title: 'Логическое',
    category: c,
    description: 'Задаёт логическое значение: да или нет.',
    inputs: [{ name: 'value', type: 'boolean', default: false }],
    outputs: [out('value', 'boolean')],
    compute: (i) => ({ value: i.value! }),
  }),
  defineNode({
    id: 'builtin:json',
    title: 'JSON-значение',
    category: c,
    description: 'Задаёт любое значение в формате JSON: массив, объект, null и т. д.',
    inputs: [{ name: 'value', type: 'any', default: null }],
    outputs: [out('value', 'any')],
    compute: (i) => ({ value: i.value! }),
  }),
];

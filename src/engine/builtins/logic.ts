import { deepEqual } from '../values';
import { categories, defineNode, out, req } from './define';

const c = categories.logic;

export const logicNodes = [
  defineNode({
    id: 'builtin:equals',
    title: 'Равно',
    category: c,
    description: 'Проверяет, что a и b равны (с учётом вложенных массивов и объектов).',
    inputs: [req('a', 'any'), req('b', 'any')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: deepEqual(i.a!, i.b!) }),
  }),
  defineNode({
    id: 'builtin:greater',
    title: 'Больше',
    category: c,
    description: 'a > b',
    inputs: [req('a', 'number'), req('b', 'number')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: (i.a as number) > (i.b as number) }),
  }),
  defineNode({
    id: 'builtin:less',
    title: 'Меньше',
    category: c,
    description: 'a < b',
    inputs: [req('a', 'number'), req('b', 'number')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: (i.a as number) < (i.b as number) }),
  }),
  defineNode({
    id: 'builtin:and',
    title: 'И',
    category: c,
    description: 'Истина, если истинны оба значения.',
    inputs: [req('a', 'boolean'), req('b', 'boolean')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: (i.a as boolean) && (i.b as boolean) }),
  }),
  defineNode({
    id: 'builtin:or',
    title: 'Или',
    category: c,
    description: 'Истина, если истинно хотя бы одно значение.',
    inputs: [req('a', 'boolean'), req('b', 'boolean')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: (i.a as boolean) || (i.b as boolean) }),
  }),
  defineNode({
    id: 'builtin:not',
    title: 'Не',
    category: c,
    description: 'Обращает логическое значение.',
    inputs: [req('value', 'boolean')],
    outputs: [out('result', 'boolean')],
    compute: (i) => ({ result: !(i.value as boolean) }),
  }),
  defineNode({
    id: 'builtin:if',
    title: 'Если',
    category: categories.condition,
    description: 'Выбирает «то», если условие истинно, иначе «иначе».',
    inputs: [req('condition', 'boolean'), req('then', 'any'), req('else', 'any')],
    outputs: [out('result', 'any')],
    compute: (i) => ({ result: i.condition ? i.then! : i.else! }),
  }),
];

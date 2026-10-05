import { categories, defineNode, req } from './define';

export const displayNodes = [
  defineNode({
    id: 'builtin:show',
    title: 'Показать',
    category: categories.display,
    description: 'Крупно показывает значение.',
    inputs: [req('value', 'any')],
    outputs: [],
    compute: () => ({}),
  }),
];

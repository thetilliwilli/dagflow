import { categories, defineNode, req } from './define';

export const displayNodes = [
  defineNode({
    id: 'builtin:show',
    title: 'Show',
    category: categories.display,
    description: 'Shows the value in large type.',
    inputs: [req('value', 'any')],
    outputs: [],
    compute: () => ({}),
  }),
];

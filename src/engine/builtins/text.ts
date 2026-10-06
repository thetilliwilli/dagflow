import { NodeError, nodeErrors } from '../errors';
import { categories, defineNode, out, req } from './define';

const c = categories.text;

export const textNodes = [
  defineNode({
    id: 'builtin:concat',
    title: 'Concatenate',
    category: c,
    description: 'Joins two texts: a + b.',
    inputs: [req('a', 'text'), req('b', 'text')],
    outputs: [out('result', 'text')],
    compute: (i) => ({ result: (i.a as string) + (i.b as string) }),
  }),
  defineNode({
    id: 'builtin:text-length',
    title: 'Text length',
    category: c,
    description: 'Number of characters in the text.',
    inputs: [req('text', 'text')],
    outputs: [out('length', 'number')],
    compute: (i) => ({ length: [...(i.text as string)].length }),
  }),
  defineNode({
    id: 'builtin:to-text',
    title: 'To text',
    category: c,
    description: 'Turns any value into text: text as is, everything else as JSON.',
    inputs: [req('value', 'any')],
    outputs: [out('text', 'text')],
    compute: (i) => ({ text: typeof i.value === 'string' ? i.value : JSON.stringify(i.value) }),
  }),
  defineNode({
    id: 'builtin:to-number',
    title: 'To number',
    category: c,
    description: 'Turns text into a number.',
    inputs: [req('text', 'text')],
    outputs: [out('value', 'number')],
    compute: (i) => {
      const text = i.text as string;
      const n = Number(text.trim());
      if (text.trim() === '' || !Number.isFinite(n)) throw new NodeError(nodeErrors.notANumber(text));
      return { value: n };
    },
  }),
];

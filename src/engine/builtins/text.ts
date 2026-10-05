import { NodeError } from '../errors';
import { categories, defineNode, out, req } from './define';

const c = categories.text;

export const textNodes = [
  defineNode({
    id: 'builtin:concat',
    title: 'Склеить',
    category: c,
    description: 'Склеивает два текста: a + b.',
    inputs: [req('a', 'text'), req('b', 'text')],
    outputs: [out('result', 'text')],
    compute: (i) => ({ result: (i.a as string) + (i.b as string) }),
  }),
  defineNode({
    id: 'builtin:text-length',
    title: 'Длина текста',
    category: c,
    description: 'Количество символов в тексте.',
    inputs: [req('text', 'text')],
    outputs: [out('length', 'number')],
    compute: (i) => ({ length: [...(i.text as string)].length }),
  }),
  defineNode({
    id: 'builtin:to-text',
    title: 'В текст',
    category: c,
    description: 'Превращает любое значение в текст: текст — как есть, остальное — в JSON.',
    inputs: [req('value', 'any')],
    outputs: [out('text', 'text')],
    compute: (i) => ({ text: typeof i.value === 'string' ? i.value : JSON.stringify(i.value) }),
  }),
  defineNode({
    id: 'builtin:to-number',
    title: 'В число',
    category: c,
    description: 'Превращает текст в число.',
    inputs: [req('text', 'text')],
    outputs: [out('value', 'number')],
    compute: (i) => {
      const text = i.text as string;
      const n = Number(text.trim());
      if (text.trim() === '' || !Number.isFinite(n)) throw new NodeError(`"${text}" не является числом`);
      return { value: n };
    },
  }),
];
